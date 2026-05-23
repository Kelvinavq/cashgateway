function isValidDomainHostname(hostname) {
  if (typeof hostname !== 'string') return false;

  const value = hostname.trim().toLowerCase();
  if (!value || value.length > 255) return false;

  if (value === 'localhost') return true;

  const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4.test(value)) {
    return value.split('.').every(part => Number(part) >= 0 && Number(part) <= 255);
  }

  const domainPattern = /^(?=.{1,255}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
  return domainPattern.test(value);
}

function normalizeDomain(input, { stripWww = true } = {}) {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  let candidate = trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/^\/+/, '');

  try {
    const parsed = new URL(`http://${candidate}`);
    let hostname = parsed.hostname.toLowerCase();

    if (stripWww && hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }

    if (!isValidDomainHostname(hostname)) return null;
    return hostname;
  } catch {
    return null;
  }
}

function normalizeDomainList(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const hostname = normalizeDomain(value);
    if (!hostname || seen.has(hostname)) continue;
    seen.add(hostname);
    result.push(hostname);
  }

  return result;
}

module.exports = {
  normalizeDomain,
  normalizeDomainList,
  isValidDomainHostname,
};
