import { describe, expect, it } from 'vitest';

import { toCnApiTestError } from './i18nErrors';

describe('toCnApiTestError', () => {
  it('translates openai missing module error', () => {
    expect(toCnApiTestError("No module named 'openai'")).toContain('服务端缺少依赖 openai');
  });

  it('passes through unknown errors', () => {
    expect(toCnApiTestError('something else')).toBe('something else');
  });
});

