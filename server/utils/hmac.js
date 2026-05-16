const crypto = require('crypto');

function verifyHmacSignature(payload, secret, signature, algorithm = 'sha256') {
  const expected = crypto
    .createHmac(algorithm, secret)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature.replace(/^sha256=/, '')),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = { verifyHmacSignature, generateToken };
