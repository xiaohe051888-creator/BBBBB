import { describe, expect, it } from 'vitest';

import { buildModeReadiness } from './modeReadiness';
import type { ThreeModelStatus } from '../services/api';

const model = (overrides: Partial<ThreeModelStatus['models']['banker']> = {}): ThreeModelStatus['models']['banker'] => ({
  name: 'test',
  provider: 'test',
  model: 'test-model',
  api_key_set: false,
  role: 'test-role',
  ...overrides,
});

describe('buildModeReadiness', () => {
  it('builds ai and single mode readiness with human-readable reasons', () => {
    const readiness = buildModeReadiness({
      status: 'incomplete',
      all_api_keys_configured: false,
      smart_router_enabled: false,
      fallback_policy: 'rule',
      ai_ready_for_enable: false,
      single_ai_ready_for_enable: false,
      models: {
        banker: model({ api_key_set: false, last_test_ok: false, role: 'banker' }),
        player: model({ api_key_set: true, last_test_ok: false, role: 'player' }),
        combined: model({ api_key_set: true, last_test_ok: true, role: 'combined' }),
        single: model({ api_key_set: false, last_test_ok: false, role: 'single' }),
      },
    });

    expect(readiness.aiReady).toBe(false);
    expect(readiness.singleReady).toBe(false);
    expect(readiness.missing3Ai).toEqual([
      '庄方向还没完成设置',
      '闲方向还不能正常使用',
    ]);
    expect(readiness.missingSingle).toEqual(['单 AI 还没完成设置']);
  });

  it('treats rule mode as always available when all ai checks are empty', () => {
    const readiness = buildModeReadiness({
      status: 'ready',
      all_api_keys_configured: true,
      smart_router_enabled: false,
      fallback_policy: 'rule',
      ai_ready_for_enable: true,
      single_ai_ready_for_enable: true,
      models: {
        banker: model({ api_key_set: true, last_test_ok: true, role: 'banker' }),
        player: model({ api_key_set: true, last_test_ok: true, role: 'player' }),
        combined: model({ api_key_set: true, last_test_ok: true, role: 'combined' }),
        single: model({ api_key_set: true, last_test_ok: true, role: 'single' }),
      },
    });

    expect(readiness.aiReady).toBe(true);
    expect(readiness.singleReady).toBe(true);
    expect(readiness.missing3Ai).toEqual([]);
    expect(readiness.missingSingle).toEqual([]);
    expect(readiness.ruleReady).toBe(true);
  });
});
