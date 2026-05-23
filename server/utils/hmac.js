const crypto = require('crypto');

/**
 * Sign data with HMAC-SHA256. Returns hex digest.
 */
function signPayload(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Sign a forwarded webhook payload using timestamp-prefixed signing:
 *   signedPayload = `${timestamp}.${rawBody}`
 *
 * This ties the signature to a specific point in time, enabling replay-attack detection.
 */
function signWebhookPayload(rawBody, secret, timestamp) {
  const signedPayload = `${timestamp}.${rawBody}`;
  return signPayload(signedPayload, secret);
}

/**
 * Verify an inbound HMAC signature (legacy – signs body only).
 * Used internally for any legacy HMAC verification needs.
 */
function verifyHmacSignature(payload, secret, signature) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const expected = signPayload(body, secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature.replace(/^sha256=/, '')),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

/**
 * Verify a timestamped gateway signature (v3):
 *   signature header = `sha256=<hex>`
 *   signed payload   = `${timestamp}.${rawBody}`
 *
 * @param {string} rawBody   - Exact bytes of the request body
 * @param {string} secret    - Domain signing secret
 * @param {string} signature - `x-gateway-signature` header value (e.g. "sha256=abc...")
 * @param {string} timestamp - `x-gateway-timestamp` header value (unix seconds as string)
 * @param {number} toleranceSec - Max allowed age in seconds (default: 300)
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyTimestampedSignature(rawBody, secret, signature, timestamp, toleranceSec = 300) {
  if (!signature || !timestamp) {
    return { valid: false, reason: 'missing_headers' };
  }

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return { valid: false, reason: 'invalid_timestamp' };
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > toleranceSec) {
    return { valid: false, reason: 'replay_attack' };
  }

  const expected = signWebhookPayload(rawBody, secret, timestamp);
  try {
    const sigHex = signature.replace(/^sha256=/, '');
    const valid = crypto.timingSafeEqual(
      Buffer.from(sigHex),
      Buffer.from(expected)
    );
    return { valid, reason: valid ? undefined : 'signature_mismatch' };
  } catch {
    return { valid: false, reason: 'comparison_error' };
  }
}

function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = {
  signPayload,
  signWebhookPayload,
  verifyHmacSignature,
  verifyTimestampedSignature,
  generateToken,
};
