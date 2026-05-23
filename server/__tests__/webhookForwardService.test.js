jest.mock('axios', () => ({
  post: jest.fn(),
}));

const axios = require('axios');
const { signWebhookPayload } = require('../utils/hmac');
const { forwardWebhook } = require('../services/webhookForwardService');

describe('webhookForwardService', () => {
  let dateNowSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1710000000000);
  });

  afterEach(() => {
    dateNowSpy?.mockRestore();
  });

  test('forwards provider_status outside the original HG payload', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: { received: true, gateway_event_id: 'gw-1', processed: true },
    });

    const movement = {
      id: 42,
      hg_id: 'hg-1',
      gateway_event_id: 'gw-1',
      provider_event_id: 'prov-1',
      account_id: 'acc-1',
      hgcash_account_id: 8,
      domain_id: 11,
      coelsa_code: 'COE-1',
      provider_status: 'paid',
      raw_payload: JSON.stringify({
        provider_status: 'paid',
        payload: {
          id: 'hg-1',
          amount: '1000',
          status: 'done',
          currency: 'ARS',
        },
      }),
    };

    const delivery = {
      destination_url: 'https://dominio-final/webhook',
    };

    const domain = {
      id: 11,
      name: 'Siempre Paga',
      hostname: 'siemprepaga.com',
      destination_token: 'token-1',
      gateway_signing_secret: 'secret-123',
      require_ack: false,
      base_url: 'https://siemprepaga.com',
    };

    const result = await forwardWebhook(delivery, movement, domain);

    expect(result.response.status).toBe(200);
    expect(axios.post).toHaveBeenCalledTimes(1);

    const [url, body, options] = axios.post.mock.calls[0];
    expect(url).toBe(delivery.destination_url);
    expect(body).toEqual({
      provider_status: 'paid',
      payload: {
        id: 'hg-1',
        amount: '1000',
        status: 'done',
        currency: 'ARS',
      },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const expectedSignature = signWebhookPayload(JSON.stringify(body), domain.gateway_signing_secret, timestamp);
    expect(options.headers['x-gateway-signature']).toBe(`sha256=${expectedSignature}`);
    expect(options.headers['x-destination-domain']).toBe('siemprepaga.com');
    expect(options.headers['x-destination-domain-id']).toBe('11');
    expect(options.headers['x-destination-domain-name']).toBe('Siempre Paga');
  });
});
