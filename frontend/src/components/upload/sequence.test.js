import { describe, expect, it } from 'vitest';
import { cycleGameResult, toggleResultAt, undoLast } from './sequence';

describe('upload sequence helpers', () => {
  it('undoLast removes only the last result', () => {
    expect(undoLast(['庄', '闲', '和'])).toEqual(['庄', '闲']);
  });

  it('cycleGameResult loops 庄→闲→和→庄', () => {
    expect(cycleGameResult('庄')).toBe('闲');
    expect(cycleGameResult('闲')).toBe('和');
    expect(cycleGameResult('和')).toBe('庄');
  });

  it('toggleResultAt changes only selected index and keeps length', () => {
    const next = toggleResultAt(['庄', '闲', '和'], 0);
    expect(next).toEqual(['闲', '闲', '和']);
  });
});
