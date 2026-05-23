jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../services/schemaService', () => ({
  hasColumn: jest.fn(async () => true),
}));

const { pool } = require('../config/database');
const { saveMovement, updateMovement, syncDeliveriesForMovement } = require('../services/movementService');

describe('movementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('persists multi_resolved movements with provider_status separated from payload', async () => {
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
        providerStatus: 'paid',
      }
    );

    expect(result).toEqual({ duplicate: false, id: 77 });
    const insertCall = pool.query.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO movements');
    expect(insertCall[1]).toContain('multi_resolved');
    expect(insertCall[1]).toContain('destination_domains');
    expect(insertCall[1]).toContain(11);
    expect(insertCall[1]).toContain('paid');
  });

  test('updates provider_status independently from payload.status', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 10, resolution_status: 'resolved', resolution_method: 'destination_domain', domain_id: 4 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await updateMovement(
      {
        id: 'hg-2',
        amount: '1000',
        currency: 'ARS',
        direction: 'Inbound',
        status: 'done',
        type: 'inbound',
        accountId: 'acc-2',
      },
      {
        resolved: true,
        method: 'destination_domain',
        resolutionStatus: 'resolved',
        account: { domain_id: 4 },
        domains: [{ id: 4, hostname: 'dominio.com', destination_webhook_url: 'https://dest.example/webhook' }],
      },
      {
        providerEventId: 'prov-2',
        gatewayEventId: 'gw-2',
        providerStatus: 'rejected',
        rawPayload: { id: 'hg-2', status: 'done' },
      }
    );

    expect(result).toEqual({ duplicate: false, id: 10, updated: true });
    const updateCall = pool.query.mock.calls[1];
    expect(updateCall[0]).toContain('UPDATE movements SET');
    expect(updateCall[0]).toContain('provider_status = COALESCE(?, provider_status)');
    expect(updateCall[1]).toContain('rejected');
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
