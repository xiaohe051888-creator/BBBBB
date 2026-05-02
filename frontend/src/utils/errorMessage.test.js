import { describe, expect, it } from 'vitest';
import { normalizeBackendDetail } from './errorMessage';

describe('normalizeBackendDetail', () => {
  it('maps illegal_state to Chinese', () => {
    expect(normalizeBackendDetail('illegal_state')).toBe('当前状态不允许该操作，请刷新后重试');
  });

  it('returns null for non-string', () => {
    expect(normalizeBackendDetail({})).toBe(null);
  });
});
