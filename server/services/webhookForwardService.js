const axios = require('axios');
const { signWebhookPayload } = require('../utils/hmac');
const { normalizeDomain } = require('../utils/domainNormalizer');
const logger = require('../utils/logger');

/**
 * Forward a movement to its destination domain.
 *
 * HMAC signing (when domain.gateway_signing_secret is set):
 *   signed_payload = `${timestamp}.${rawBody}`
 *   x-gateway-signature: sha256=<HMAC-SHA256(signed_payload, secret)>
 *
 * Header semantics:
 *   x-hg-movement-id     → original HG.Cash movement ID (payload.id / hg_id)
 *   x-gateway-movement-id → internal DB ID of this movement
 */
async function forwardWebhook(delivery, movement, domain) {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Use the stored raw payload string directly — preserves original byte order
  const rawBody = typeof movement.raw_payload === 'string'
    ? movement.raw_payload
    : JSON.stringify(movement.raw_payload);

  const headers = {
    'Content-Type':            'application/json',
    'x-gateway-token':         domain.destination_token || '',
    'x-destination-domain':    domain.hostname || normalizeDomain(domain.base_url) || '',
    'x-destination-domain-id': domain.id ? String(domain.id) : '',
    'x-destination-domain-name': domain.name || '',
    'x-gateway-event-id':      movement.gateway_event_id || '',
    'x-provider-event-id':     movement.provider_event_id || '',
    'x-hg-movement-id':        movement.hg_id || '',          // original HG.Cash ID
    'x-gateway-movement-id':   String(movement.id),           // internal DB ID
    'x-hg-account-id':         movement.account_id || '',
    'x-hg-account-db-id':      movement.hgcash_account_id ? String(movement.hgcash_account_id) : '',
    'x-domain-id':             movement.domain_id ? String(movement.domain_id) : '',
    'x-coelsa-code':           movement.coelsa_code || '',
    'x-gateway-timestamp':     timestamp,
  };

  if (domain.gateway_signing_secret) {
    const sig = signWebhookPayload(rawBody, domain.gateway_signing_secret, timestamp);
    headers['x-gateway-signature'] = `sha256=${sig}`;
  }

  const response = await axios.post(delivery.destination_url, JSON.parse(rawBody), {
    headers,
    timeout: 10000,
    validateStatus: null,
  });

  logger.info(`Forwarded movement ${movement.id} → ${delivery.destination_url} [HTTP ${response.status}]`);

  let ackReceived = 0;
  let ackValid = 0;
  let ackPayload = null;

  if (response.status >= 200 && response.status < 300) {
    ackReceived = 1;
    const data = response.data;

    if (domain.require_ack) {
      if (
        data &&
        data.received === true &&
        data.gateway_event_id === movement.gateway_event_id &&
        data.processed === true
      ) {
        ackValid = 1;
        ackPayload = data;
      } else {
        ackPayload = data;
        const ackError = new Error(`invalid_ack_response: ${JSON.stringify(data).substring(0, 200)}`);
        ackError.isAckError = true;
        ackError.ackReceived = ackReceived;
        ackError.ackPayload = ackPayload;
        throw ackError;
      }
    } else {
      if (data && data.received === true) {
        ackValid = data.gateway_event_id === movement.gateway_event_id && data.processed === true ? 1 : 0;
        ackPayload = data;
      }
    }
  }

  return { response, ackReceived, ackValid, ackPayload };
}

module.exports = { forwardWebhook };
