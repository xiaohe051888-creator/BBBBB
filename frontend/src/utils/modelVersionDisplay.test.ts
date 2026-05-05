import { describe, expect, it } from 'vitest';

import { formatModelVersionLabel, getModelVersionDisplay } from './modelVersionDisplay';

describe('modelVersionDisplay', () => {
  it('formats manual single-ai versions into a user-friendly label', () => {
    expect(formatModelVersionLabel('single_ai-manual-20260505093409')).toBe(
      '单AI · 手动配置 · 2026-05-05 09:34',
    );
  });

  it('builds a two-line display for manual single-ai versions', () => {
    expect(getModelVersionDisplay('single_ai-manual-20260505093409')).toEqual({
      title: '单AI · 手动配置',
      subtitle: '生效于 2026-05-05 09:34',
    });
  });

  it('returns the original value for unknown version formats', () => {
    expect(formatModelVersionLabel('single_ai-v20260505-3')).toBe('single_ai-v20260505-3');
  });

  it('falls back to a default label when the version is missing', () => {
    expect(formatModelVersionLabel(null)).toBe('默认版本');
  });
});
