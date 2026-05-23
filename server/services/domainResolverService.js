const { pool } = require('../config/database');
const { resolveAccountForMovement } = require('./accountResolverService');
const { hasColumn } = require('./schemaService');
const { normalizeDomain, normalizeDomainList } = require('../utils/domainNormalizer');

function collectDestinationHints(wrapper = {}, movementPayload = {}) {
  const rawDestinationDomains = [];

  for (const source of [wrapper, movementPayload]) {
    if (Array.isArray(source?.destination_domains)) {
      rawDestinationDomains.push(...source.destination_domains);
    }
  }

  const rawDestinationDomain =
    wrapper?.destination_domain ||
    movementPayload?.destination_domain ||
    null;

  const rawDomain =
    wrapper?.domain ||
    movementPayload?.domain ||
    null;

  return {
    rawDestinationDomains,
    rawDestinationDomain,
    rawDomain,
    hasExplicitDestinationHints: rawDestinationDomains.length > 0 || !!rawDestinationDomain || !!rawDomain,
  };
}

async function fetchActiveDomainsByHostnames(hostnames) {
  const list = Array.isArray(hostnames)
    ? hostnames.map(h => normalizeDomain(h)).filter(Boolean)
    : [];

  if (!list.length) return [];

  const hasHostname = await hasColumn('domains', 'hostname');
  let rows = [];

  if (hasHostname) {
    const placeholders = list.map(() => '?').join(', ');
    [rows] = await pool.query(
      `SELECT * FROM domains WHERE is_active = 1 AND hostname IN (${placeholders})`,
      list
    );
  } else {
    [rows] = await pool.query(
      `SELECT * FROM domains WHERE is_active = 1`
    );
  }

  const byHostname = new Map(
    rows
      .map(row => ({
        ...row,
        hostname: normalizeDomain(row.hostname || row.base_url) || null,
      }))
      .filter(row => row.hostname)
      .map(row => [String(row.hostname || '').toLowerCase(), row])
  );
  return list.map(hostname => byHostname.get(hostname)).filter(Boolean);
}

function buildExplicitResolutionResult({
  method,
  rawValues,
  normalizedValues,
  validDomains,
  invalidDomains,
  foundDomains,
  foundHostnames,
}) {
  const matchedCount = validDomains.length;
  const resolutionStatus = matchedCount > 1 ? 'multi_resolved' : 'resolved';
  const missingDomains = normalizedValues.filter(hostname => !foundHostnames.includes(hostname));
  const partialMatch = normalizedValues.length > 0 && foundDomains.length > 0 && missingDomains.length > 0;

  if (!normalizedValues.length) {
    return {
      resolved: false,
      method: 'none',
      domains: [],
      account: null,
      resolutionStatus: 'unresolved',
      unresolvedReason: invalidDomains.length
        ? 'Invalid destination domain(s) received'
        : 'No destination domain matched',
      diagnostics: {
        rawDestinationDomains: rawValues,
        normalizedDestinationDomains: [],
        invalidDestinationDomains: invalidDomains,
        missingDestinationDomains: [],
        foundHostnames: [],
        partialMatch: false,
      },
    };
  }

  if (foundDomains.length === 0) {
    return {
      resolved: false,
      method: 'none',
      domains: [],
      account: null,
      resolutionStatus: 'unresolved',
      unresolvedReason: invalidDomains.length
        ? 'Invalid destination domain(s) received'
        : `No active domain found for ${normalizedValues.join(', ')}`,
      diagnostics: {
        rawDestinationDomains: rawValues,
        normalizedDestinationDomains: normalizedValues,
        invalidDestinationDomains: invalidDomains,
        missingDestinationDomains: normalizedValues,
        foundHostnames: [],
        partialMatch: false,
      },
    };
  }

  return {
    resolved: true,
    method,
    domains: foundDomains,
    account: null,
    resolutionStatus,
    unresolvedReason: null,
    diagnostics: {
      rawDestinationDomains: rawValues,
      normalizedDestinationDomains: normalizedValues,
      invalidDestinationDomains: invalidDomains,
      missingDestinationDomains: missingDomains,
      foundHostnames,
      partialMatch,
    },
  };
}

async function resolveDestinationsForWebhook({ wrapper = {}, movementPayload = {}, allowAccountFallback = true } = {}) {
  const hints = collectDestinationHints(wrapper, movementPayload);

  if (hints.rawDestinationDomains.length > 0) {
    const normalizedDestinationDomains = normalizeDomainList(hints.rawDestinationDomains);
    const invalidDestinationDomains = hints.rawDestinationDomains.filter(value => !normalizeDomain(value));
    const foundDomains = await fetchActiveDomainsByHostnames(normalizedDestinationDomains);
    const foundHostnames = foundDomains.map(domain => String(domain.hostname || '').toLowerCase());

    const result = buildExplicitResolutionResult({
      method: 'destination_domains',
      rawValues: hints.rawDestinationDomains,
      normalizedValues: normalizedDestinationDomains,
      validDomains: foundDomains,
      invalidDomains: invalidDestinationDomains,
      foundDomains,
      foundHostnames,
    });

    return {
      ...result,
      destinationDomainRaw: null,
      destinationDomainsRaw: hints.rawDestinationDomains,
      hasExplicitDestinationHints: true,
    };
  }

  const singleRaw = hints.rawDestinationDomain || hints.rawDomain;
  const singleMethod = hints.rawDestinationDomain ? 'destination_domain' : (hints.rawDomain ? 'domain' : 'none');

  if (singleRaw) {
    const normalized = normalizeDomain(singleRaw);
    if (!normalized) {
      return {
        resolved: false,
        method: 'none',
        domains: [],
        account: null,
        resolutionStatus: 'unresolved',
        unresolvedReason: 'Invalid destination domain received',
        diagnostics: {
          rawDestinationDomains: [],
          normalizedDestinationDomains: [],
          invalidDestinationDomains: [singleRaw],
          missingDestinationDomains: [],
          foundHostnames: [],
          partialMatch: false,
        },
        destinationDomainRaw: singleRaw,
        destinationDomainsRaw: null,
        hasExplicitDestinationHints: true,
      };
    }

    const foundDomains = await fetchActiveDomainsByHostnames([normalized]);
    if (!foundDomains.length) {
      return {
        resolved: false,
        method: 'none',
        domains: [],
        account: null,
        resolutionStatus: 'unresolved',
        unresolvedReason: `Destination domain not found: ${normalized}`,
        diagnostics: {
          rawDestinationDomains: [singleRaw],
          normalizedDestinationDomains: [normalized],
          invalidDestinationDomains: [],
          missingDestinationDomains: [normalized],
          foundHostnames: [],
          partialMatch: false,
        },
        destinationDomainRaw: singleRaw,
        destinationDomainsRaw: null,
        hasExplicitDestinationHints: true,
      };
    }

    return {
      resolved: true,
      method: singleMethod,
      domains: foundDomains,
      account: null,
      resolutionStatus: 'resolved',
      unresolvedReason: null,
      diagnostics: {
        rawDestinationDomains: [singleRaw],
        normalizedDestinationDomains: [normalized],
        invalidDestinationDomains: [],
        missingDestinationDomains: [],
        foundHostnames: foundDomains.map(domain => String(domain.hostname || '').toLowerCase()),
        partialMatch: false,
      },
      destinationDomainRaw: singleMethod === 'destination_domain' || singleMethod === 'domain' ? singleRaw : null,
      destinationDomainsRaw: null,
      hasExplicitDestinationHints: true,
    };
  }

  if (!allowAccountFallback) {
    return {
      resolved: false,
      method: 'none',
      domains: [],
      account: null,
      resolutionStatus: 'unresolved',
      unresolvedReason: 'No destination domain hints provided',
      diagnostics: {
        rawDestinationDomains: [],
        normalizedDestinationDomains: [],
        invalidDestinationDomains: [],
        missingDestinationDomains: [],
        foundHostnames: [],
        partialMatch: false,
      },
      destinationDomainRaw: null,
      destinationDomainsRaw: null,
      hasExplicitDestinationHints: false,
    };
  }

  const accountResult = await resolveAccountForMovement(movementPayload);
  if (accountResult.resolved) {
    return {
      resolved: true,
      method: accountResult.method,
      domains: accountResult.domain ? [accountResult.domain] : [],
      account: accountResult.account || null,
      resolutionStatus: 'resolved',
      unresolvedReason: null,
      diagnostics: {
        rawDestinationDomains: [],
        normalizedDestinationDomains: [],
        invalidDestinationDomains: [],
        missingDestinationDomains: [],
        foundHostnames: accountResult.domain?.hostname ? [accountResult.domain.hostname] : [],
        partialMatch: false,
      },
      destinationDomainRaw: null,
      destinationDomainsRaw: null,
      hasExplicitDestinationHints: false,
    };
  }

  return {
    resolved: false,
    method: 'none',
    domains: [],
    account: null,
    resolutionStatus: 'unresolved',
    unresolvedReason: accountResult.reason || 'No destination domain/accountId/toCBU/toCUIT matched',
    diagnostics: {
      rawDestinationDomains: [],
      normalizedDestinationDomains: [],
      invalidDestinationDomains: [],
      missingDestinationDomains: [],
      foundHostnames: [],
      partialMatch: false,
    },
    destinationDomainRaw: null,
    destinationDomainsRaw: null,
    hasExplicitDestinationHints: false,
  };
}

module.exports = {
  resolveDestinationsForWebhook,
  collectDestinationHints,
  fetchActiveDomainsByHostnames,
};
