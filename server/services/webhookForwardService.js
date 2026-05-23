const axios = require('axios');
const logger = require('../utils/logger');

async function forwardWebhook(delivery, movement, domain) {
  const headers = {
    'Content-Type': 'application/json',
    'x-gateway-token':      domain.destination_token || '',
    'x-gateway-event-id':   movement.gateway_event_id || '',
    'x-provider-event-id':  movement.provider_event_id || '',
    'x-hg-movement-id':     String(movement.id),
    'x-hg-account-id':      movement.account_id || '',
    'x-hg-account-db-id':   movement.hgcash_account_id ? String(movement.hgcash_account_id) : '',
    'x-domain-id':          movement.domain_id ? String(movement.domain_id) : '',
    'x-coelsa-code':        movement.coelsa_code || '',
  };

  const response = await axios.post(delivery.destination_url, movement.raw_payload, {
    headers,
    timeout: 10000,
    validateStatus: null,
  });

  logger.info(`Forwarded movement ${movement.id} → ${delivery.destination_url} [HTTP ${response.status}]`);
  return response;
}

module.exports = { forwardWebhook };
