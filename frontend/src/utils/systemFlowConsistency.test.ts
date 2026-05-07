import { describe, expect, it } from 'vitest';

import { formatAccuracyPercent, resolvePredictionMode } from './systemFlowConsistency';

describe('systemFlowConsistency', () => {
  it('treats stats accuracy as an already-scaled percentage', () => {
    expect(formatAccuracyPercent(55.3)).toBe('55.3%');
    expect(formatAccuracyPercent(0)).toBe('0.0%');
  });

  it('falls back to rule mode when no runtime mode is available yet', () => {
    expect(resolvePredictionMode(undefined, undefined)).toBe('rule');
  });

  it('prefers system state mode over analysis mode', () => {
    expect(resolvePredictionMode('single_ai', 'ai')).toBe('single_ai');
  });
});
