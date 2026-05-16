const axios = require('axios');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

async function forwardWebhook(delivery, movement, domain) {
  const headers = {
    'Content-Type': 'application/json',
    'x-gateway-token': domain.destination_token || '',
    'x-hg-account-id': movement.account_id || '',
    'x-hg-movement-id': String(movement.id),
    'x-coelsa-code': movement.coelsa_code || '',
  };

  const response = await axios.post(delivery.destination_url, movement.raw_payload, {
    headers,
    timeout: 10000,
    validateStatus: null,
  });

  return response;
}

module.exports = { forwardWebhook };
