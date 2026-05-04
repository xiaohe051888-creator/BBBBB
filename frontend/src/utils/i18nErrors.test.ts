import { describe, expect, it } from 'vitest';

import {
  toCnApiTestError,
  toCnModelLabel,
  toCnProviderLabel,
  toCnRoadAlias,
} from './i18nErrors';

describe('toCnApiTestError', () => {
  it('translates openai missing module error', () => {
    expect(toCnApiTestError("No module named 'openai'")).toContain('服务端缺少依赖 openai');
  });

  it('passes through unknown errors', () => {
    expect(toCnApiTestError('something else')).toBe('something else');
  });
});

describe('中文显示映射', () => {
  it('translates provider keys to Chinese labels', () => {
    expect(toCnProviderLabel('openai')).toBe('开放AI平台');
    expect(toCnProviderLabel('anthropic')).toBe('克劳德平台');
  });

  it('translates common model ids to Chinese labels', () => {
    expect(toCnModelLabel('deepseek-v4-pro')).toBe('深度求索 V4 专业版');
    expect(toCnModelLabel('gpt-4o')).toBe('开放AI 旗舰版');
  });

  it('translates road aliases to Chinese labels', () => {
    expect(toCnRoadAlias('Big Road')).toBe('大路');
    expect(toCnRoadAlias('Cockroach')).toBe('螳螂路');
  });
});
