jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../services/accountResolverService', () => ({
  resolveAccountForMovement: jest.fn(),
}));

jest.mock('../services/schemaService', () => ({
  hasColumn: jest.fn(),
}));

const { pool } = require('../config/database');
const { resolveAccountForMovement } = require('../services/accountResolverService');
const { hasColumn } = require('../services/schemaService');
const { resolveDestinationsForWebhook } = require('../services/domainResolverService');

describe('domainResolverService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasColumn.mockResolvedValue(true);
  });

  test('resolves multiple explicit destination domains and marks multi_resolved', async () => {
    pool.query.mockResolvedValueOnce([[
      { id: 1, hostname: 'siemprepaga.com', name: 'Siempre Paga', is_active: 1, destination_webhook_url: 'https://dest1.example/webhook' },
      { id: 2, hostname: 'betcity.com', name: 'Bet City', is_active: 1, destination_webhook_url: 'https://dest2.example/webhook' },
    ]]);

    const result = await resolveDestinationsForWebhook({
      wrapper: {
        destination_domains: ['https://www.SiemprePaga.com/webhook', 'betcity.com', '  BETCITY.com  ', 'nota-valid'],
      },
      movementPayload: {},
    });

    expect(result.resolved).toBe(true);
    expect(result.method).toBe('destination_domains');
    expect(result.resolutionStatus).toBe('multi_resolved');
    expect(result.domains).toHaveLength(2);
    expect(result.diagnostics.invalidDestinationDomains).toContain('nota-valid');
    expect(result.diagnostics.normalizedDestinationDomains).toEqual(['siemprepaga.com', 'betcity.com']);
  });

  test('falls back to account resolution when no explicit destination is provided', async () => {
    resolveAccountForMovement.mockResolvedValueOnce({
      resolved: true,
      method: 'account_id',
      account: { id: 9, account_id: 'acc-1' },
      domain: { id: 3, hostname: 'fallback.example', destination_webhook_url: 'https://fallback.example/webhook' },
    });

    const result = await resolveDestinationsForWebhook({
      wrapper: {},
      movementPayload: { accountId: 'acc-1' },
    });

    expect(resolveAccountForMovement).toHaveBeenCalledWith({ accountId: 'acc-1' });
    expect(result.resolved).toBe(true);
    expect(result.method).toBe('account_id');
    expect(result.resolutionStatus).toBe('resolved');
    expect(result.domains).toHaveLength(1);
  });
});
