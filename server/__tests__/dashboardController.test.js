jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../config/redis', () => ({
  redisClient: {
    get: jest.fn(),
    setEx: jest.fn(),
  },
}));

jest.mock('../services/schemaService', () => ({
  hasColumn: jest.fn(async () => true),
}));

jest.mock('../utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
}));

const { pool } = require('../config/database');
const { redisClient } = require('../config/redis');
const { getStats } = require('../controllers/dashboardController');

describe('dashboardController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisClient.get.mockResolvedValue(null);
    redisClient.setEx.mockResolvedValue(undefined);
  });

  test('returns provider status metrics and recent movements with provider_status', async () => {
    pool.query
      .mockResolvedValueOnce([[{
        total_movements: 2,
        inbound_count: 1,
        outbound_count: 1,
        total_ars_received: 1000,
        resolved_count: 1,
        unresolved_count: 0,
        manually_resolved_count: 0,
        destination_domain_resolved_count: 1,
        multi_destination_count: 1,
        unresolved_invalid_domain_count: 0,
        provider_pending_count: 1,
        provider_paid_count: 1,
        provider_rejected_count: 0,
      }]])
      .mockResolvedValueOnce([[{
        delivered_ok: 1,
        failed: 0,
        pending: 1,
        dead: 0,
        ack_valid_count: 1,
        ack_invalid_count: 0,
      }]])
      .mockResolvedValueOnce([[{ active_providers: 3 }]])
      .mockResolvedValueOnce([[{
        rate_limit_hits: 0,
        dead_deliveries_total: 0,
        reactivated_total: 0,
        webhook_errors: 0,
        invalid_destination_domains: 0,
        destination_domain_not_found: 0,
        destination_domains_partial_match: 0,
        multi_destination_resolved: 1,
      }]])
      .mockResolvedValueOnce([[{ multi_destination_deliveries: 2 }]])
      .mockResolvedValueOnce([[
        {
          id: 1,
          hg_id: 'hg-1',
          amount: 1000,
          currency: 'ARS',
          direction: 'Inbound',
          status: 'done',
          provider_status: 'paid',
          from_name: 'Alice',
          to_name: 'Bob',
          coelsa_code: 'COE-1',
          received_at: '2026-05-16T14:36:59Z',
          resolution_status: 'multi_resolved',
          resolution_method: 'destination_domains',
          destination_domain_raw: 'siemprepaga.com',
          destination_domains_raw: '["siemprepaga.com","betcity.com"]',
          domain_name: 'Siempre Paga',
          domain_hostname: 'siemprepaga.com',
          delivery_count: 2,
          delivery_status: 'pending',
        },
      ]])
      .mockResolvedValueOnce([[
        {
          id: 9,
          hg_id: 'hg-2',
          amount: 500,
          currency: 'ARS',
          domain_name: 'Siempre Paga',
        },
      ]]);

    const req = {};
    const res = {
      json: jest.fn(),
    };
    const next = jest.fn();

    await getStats(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        movements: expect.objectContaining({
          provider_pending: 1,
          provider_paid: 1,
          provider_rejected: 0,
          multi_destination: 1,
        }),
        recent_movements: expect.arrayContaining([
          expect.objectContaining({
            provider_status: 'paid',
          }),
        ]),
      }),
    }));
  });
});
