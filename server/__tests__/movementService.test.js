jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const { pool } = require('../config/database');
const { saveMovement, syncDeliveriesForMovement } = require('../services/movementService');

describe('movementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('persists multi_resolved movements with the primary domain id', async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 77 }]);

    const result = await saveMovement(
      {
        id: 'hg-1',
        amount: '1500',
        currency: 'ARS',
        direction: 'Inbound',
        status: 'done',
        type: 'inbound',
        date: '2026-05-16T14:36:59',
        timezone: 'America/Argentina/Buenos_Aires',
        accountId: 'acc-1',
      },
      {
        resolved: true,
        method: 'destination_domains',
        resolutionStatus: 'multi_resolved',
        unresolvedReason: null,
        account: null,
        domains: [
          { id: 11, hostname: 'siemprepaga.com', destination_webhook_url: 'https://one.example/webhook' },
          { id: 12, hostname: 'betcity.com', destination_webhook_url: 'https://two.example/webhook' },
        ],
      },
      {
        gatewayEventId: 'gw-1',
        rawPayload: { id: 'hg-1' },
        destinationDomainsRaw: ['siemprepaga.com', 'betcity.com'],
      }
    );

    expect(result).toEqual({ duplicate: false, id: 77 });
    const insertCall = pool.query.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO movements');
    expect(insertCall[1]).toContain('multi_resolved');
    expect(insertCall[1]).toContain('destination_domains');
    expect(insertCall[1]).toContain(11);
  });

  test('syncDeliveriesForMovement deduplicates domains before inserting deliveries', async () => {
    pool.query.mockResolvedValue([{ affectedRows: 1, insertId: 201 }]);

    const result = await syncDeliveriesForMovement(33, [
      { id: 1, destination_webhook_url: 'https://one.example/webhook' },
      { id: 1, destination_webhook_url: 'https://one.example/webhook' },
      { id: 2, destination_webhook_url: 'https://two.example/webhook' },
      { id: 3, destination_webhook_url: null },
    ]);

    expect(result.created).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });
});
