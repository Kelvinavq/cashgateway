/**
 * IP whitelist validator.
 * Supports exact IPv4/IPv6 match and IPv4 CIDR notation (e.g. "10.0.0.0/8").
 */

function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function matchesCidr(ip, cidr) {
  const [network, prefixStr] = cidr.split('/');
  if (!prefixStr) return ip === network;
  const prefix = parseInt(prefixStr, 10);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  try {
    return (ipToInt(ip) & mask) === (ipToInt(network) & mask);
  } catch {
    return false;
  }
}

/**
 * Extract the real client IP from a request.
 * Handles proxies via x-forwarded-for.
 */
function extractIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '0.0.0.0';
}

/**
 * Check whether an IP is allowed by a whitelist.
 * @param {string} ip
 * @param {string[]|null} whitelist  - Array of IPs/CIDRs, or null/empty to allow all
 * @returns {boolean}
 */
function isIpAllowed(ip, whitelist) {
  if (!whitelist || whitelist.length === 0) return true;
  const normalizedIp = ip.replace(/^::ffff:/, ''); // strip IPv4-mapped IPv6 prefix
  return whitelist.some(entry => matchesCidr(normalizedIp, entry));
}

module.exports = { extractIp, isIpAllowed };
