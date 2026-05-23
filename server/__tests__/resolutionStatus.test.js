const { RESOLUTION_STATUS_CONFIG } = require('../../shared/resolutionStatus.cjs');

describe('resolution status config', () => {
  test('exposes multi_resolved for UI badges and filters', () => {
    expect(RESOLUTION_STATUS_CONFIG.multi_resolved).toMatchObject({
      label: 'Multi destino',
    });
  });
});
