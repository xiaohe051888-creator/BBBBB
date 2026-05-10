import { describe, expect, it } from 'vitest';

import { adminMaintenanceAlerts, adminMaintenanceAcknowledgeAlerts, retrySingleAiAnalysis } from './api';

describe('admin maintenance alerts api', () => {
  it('exports acknowledge alerts call', () => {
    expect(typeof adminMaintenanceAlerts).toBe('function');
    expect(typeof adminMaintenanceAcknowledgeAlerts).toBe('function');
    expect(typeof retrySingleAiAnalysis).toBe('function');
  });
});
