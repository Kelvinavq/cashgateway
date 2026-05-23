const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

function signPayload(body, secret) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Forward a movement to its destination domain.
 * Adds HMAC signature + timestamp when domain has gateway_signing_secret.
 *
 * Returns { response, ackReceived, ackValid, ackPayload }
 */
async function forwardWebhook(delivery, movement, domain) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const rawBody = JSON.stringify(movement.raw_payload);

  const headers = {
    'Content-Type':          'application/json',
    'x-gateway-token':       domain.destination_token || '',
    'x-gateway-event-id':    movement.gateway_event_id || '',
    'x-provider-event-id':   movement.provider_event_id || '',
    'x-hg-movement-id':      String(movement.id),
    'x-hg-account-id':       movement.account_id || '',
    'x-hg-account-db-id':    movement.hgcash_account_id ? String(movement.hgcash_account_id) : '',
    'x-domain-id':           movement.domain_id ? String(movement.domain_id) : '',
    'x-coelsa-code':         movement.coelsa_code || '',
    'x-gateway-timestamp':   timestamp,
  };

  if (domain.gateway_signing_secret) {
    const sig = signPayload(rawBody, domain.gateway_signing_secret);
    headers['x-gateway-signature'] = `sha256=${sig}`;
  }

  const response = await axios.post(delivery.destination_url, movement.raw_payload, {
    headers,
    timeout: 10000,
    validateStatus: null,
  });

  logger.info(`Forwarded movement ${movement.id} → ${delivery.destination_url} [HTTP ${response.status}]`);

  // ACK validation
  let ackReceived = 0;
  let ackValid = 0;
  let ackPayload = null;

  if (response.status >= 200 && response.status < 300) {
    ackReceived = 1;
    const data = response.data;

    if (domain.require_ack) {
      // Strict mode: domain must respond with structured ACK
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
      // Permissive mode: record ACK if present but don't enforce
      if (data && data.received === true) {
        ackValid = data.gateway_event_id === movement.gateway_event_id && data.processed === true ? 1 : 0;
        ackPayload = data;
      }
    }
  }

  return { response, ackReceived, ackValid, ackPayload };
}

module.exports = { forwardWebhook };
