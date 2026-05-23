'use strict';

const crypto = require('crypto');
const {
  signWebhookPayload,
  verifyTimestampedSignature,
  verifyHmacSignature,
  generateToken,
} = require('../utils/hmac');

// ─── Helpers ────────────────────────────────────────────────────────────────

const SECRET = 'test-secret-32-bytes-abcdefghijk';

function makeTimestamp(offsetSec = 0) {
  return String(Math.floor(Date.now() / 1000) + offsetSec);
}

function makeSignature(rawBody, secret, timestamp) {
  const hex = signWebhookPayload(rawBody, secret, timestamp);
  return `sha256=${hex}`;
}

// ─── signWebhookPayload ──────────────────────────────────────────────────────

describe('signWebhookPayload', () => {
  test('returns a 64-char hex string', () => {
    const sig = signWebhookPayload('{"amount":"100"}', SECRET, '1234567890');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  test('different timestamps produce different signatures', () => {
    const body = '{"amount":"100"}';
    const s1 = signWebhookPayload(body, SECRET, '1000000000');
    const s2 = signWebhookPayload(body, SECRET, '1000000001');
    expect(s1).not.toBe(s2);
  });

  test('different bodies produce different signatures', () => {
    const ts = '1000000000';
    const s1 = signWebhookPayload('{"amount":"100"}', SECRET, ts);
    const s2 = signWebhookPayload('{"amount":"200"}', SECRET, ts);
    expect(s1).not.toBe(s2);
  });

  test('different secrets produce different signatures', () => {
    const body = '{"amount":"100"}';
    const ts = '1000000000';
    const s1 = signWebhookPayload(body, 'secret-a', ts);
    const s2 = signWebhookPayload(body, 'secret-b', ts);
    expect(s1).not.toBe(s2);
  });

  test('is deterministic for same inputs', () => {
    const body = '{"amount":"100"}';
    const ts = '1000000000';
    const s1 = signWebhookPayload(body, SECRET, ts);
    const s2 = signWebhookPayload(body, SECRET, ts);
    expect(s1).toBe(s2);
  });
});

// ─── verifyTimestampedSignature ──────────────────────────────────────────────

describe('verifyTimestampedSignature', () => {
  test('returns valid=true for a correct, fresh signature', () => {
    const ts = makeTimestamp();
    const body = '{"id":"abc","amount":"500"}';
    const sig = makeSignature(body, SECRET, ts);
    const result = verifyTimestampedSignature(body, SECRET, sig, ts);
    expect(result.valid).toBe(true);
  });

  test('returns valid=false for a tampered body', () => {
    const ts = makeTimestamp();
    const body = '{"id":"abc","amount":"500"}';
    const tampered = '{"id":"abc","amount":"9999"}';
    const sig = makeSignature(body, SECRET, ts);
    const result = verifyTimestampedSignature(tampered, SECRET, sig, ts);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('signature_mismatch');
  });

  test('returns valid=false for a wrong secret', () => {
    const ts = makeTimestamp();
    const body = '{"id":"abc","amount":"500"}';
    const sig = makeSignature(body, 'wrong-secret', ts);
    const result = verifyTimestampedSignature(body, SECRET, sig, ts);
    expect(result.valid).toBe(false);
  });

  test('detects replay attack — timestamp too old', () => {
    const ts = makeTimestamp(-400); // 400 seconds ago
    const body = '{"id":"abc","amount":"500"}';
    const sig = makeSignature(body, SECRET, ts);
    const result = verifyTimestampedSignature(body, SECRET, sig, ts, 300);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('replay_attack');
  });

  test('detects replay attack — timestamp in the future beyond tolerance', () => {
    const ts = makeTimestamp(400); // 400 seconds in the future
    const body = '{"id":"abc","amount":"500"}';
    const sig = makeSignature(body, SECRET, ts);
    const result = verifyTimestampedSignature(body, SECRET, sig, ts, 300);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('replay_attack');
  });

  test('accepts timestamp within tolerance window', () => {
    const ts = makeTimestamp(-100); // 100 seconds ago — within 300s
    const body = '{"id":"abc","amount":"500"}';
    const sig = makeSignature(body, SECRET, ts);
    const result = verifyTimestampedSignature(body, SECRET, sig, ts, 300);
    expect(result.valid).toBe(true);
  });

  test('returns missing_headers when signature is absent', () => {
    const result = verifyTimestampedSignature('body', SECRET, '', '12345');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('missing_headers');
  });

  test('returns missing_headers when timestamp is absent', () => {
    const result = verifyTimestampedSignature('body', SECRET, 'sha256=abc', '');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('missing_headers');
  });

  test('returns invalid_timestamp for non-numeric timestamp', () => {
    const result = verifyTimestampedSignature('body', SECRET, 'sha256=abc', 'not-a-number');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_timestamp');
  });
});

// ─── Raw body integrity ───────────────────────────────────────────────────────

describe('raw body integrity', () => {
  test('signing JSON.stringify output differs from signing raw bytes with different key order', () => {
    const ts = '1000000000';
    const obj1 = { b: 2, a: 1 };
    const obj2 = { a: 1, b: 2 };

    // Both serialize to different strings when using JSON.stringify
    const raw1 = JSON.stringify(obj1); // {"b":2,"a":1}
    const raw2 = JSON.stringify(obj2); // {"a":1,"b":2}

    const sig1 = signWebhookPayload(raw1, SECRET, ts);
    const sig2 = signWebhookPayload(raw2, SECRET, ts);

    // Signatures are different because raw bytes differ — this is intentional
    // Destinations must use the raw body, not re-serialize JSON
    expect(sig1).not.toBe(sig2);
  });

  test('same raw bytes always produce the same signature regardless of parsed value', () => {
    const ts = '1000000000';
    const rawBody = '{"amount":"100","id":"abc-123"}';
    const s1 = signWebhookPayload(rawBody, SECRET, ts);
    const s2 = signWebhookPayload(rawBody, SECRET, ts);
    expect(s1).toBe(s2);
  });
});

// ─── generateToken ───────────────────────────────────────────────────────────

describe('generateToken', () => {
  test('default length is 64 hex chars (32 bytes)', () => {
    const t = generateToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  test('generates unique tokens each call', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateToken()));
    expect(tokens.size).toBe(20);
  });

  test('respects custom length', () => {
    const t = generateToken(16);
    expect(t).toHaveLength(32); // 16 bytes → 32 hex chars
  });
});

// ─── verifyHmacSignature (legacy) ────────────────────────────────────────────

describe('verifyHmacSignature (legacy)', () => {
  test('verifies a correct signature', () => {
    const body = '{"amount":"500"}';
    const hex = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
    expect(verifyHmacSignature(body, SECRET, `sha256=${hex}`)).toBe(true);
  });

  test('rejects a tampered body', () => {
    const hex = crypto.createHmac('sha256', SECRET).update('original').digest('hex');
    expect(verifyHmacSignature('tampered', SECRET, `sha256=${hex}`)).toBe(false);
  });

  test('returns false for an empty signature', () => {
    expect(verifyHmacSignature('body', SECRET, '')).toBe(false);
  });
});
