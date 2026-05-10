import { describe, expect, it } from 'vitest';

import {
  toCnAnalysisDiagnostic,
  toCnApiTestError,
  toCnLogDetailText,
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
    expect(toCnProviderLabel(undefined)).toBe('暂未选择服务商');
  });

  it('translates common model ids to Chinese labels', () => {
    expect(toCnModelLabel('deepseek-v4-pro')).toBe('深度求索 V4 专业版');
    expect(toCnModelLabel('gpt-4o')).toBe('开放AI 旗舰版');
  });

  it('translates road aliases to Chinese labels', () => {
    expect(toCnRoadAlias('Big Road')).toBe('大路');
    expect(toCnRoadAlias('Cockroach')).toBe('螳螂路');
  });

  it('rewrites fallback diagnostics into beginner-friendly Chinese', () => {
    expect(toCnAnalysisDiagnostic('single_ai timeout, fallback to rule_fallback')).toBe(
      '智能判断这次没有及时给出稳定结果，系统先用备用判断继续完成这次判断。',
    );
    expect(toCnAnalysisDiagnostic('analysis timeout after 45.00s')).toBe(
      '智能判断这次没有及时给出稳定结果，系统先用备用判断继续完成这次判断。',
    );
    expect(toCnAnalysisDiagnostic('单AI没有及时返回稳定结果，已自动切换规则兜底。')).toBe(
      '智能判断这次没有及时给出稳定结果，系统先用备用判断继续完成这次判断。',
    );
  });

  it('passes through unknown diagnostics after trimming', () => {
    expect(toCnAnalysisDiagnostic('  custom diagnostic  ')).toBe('custom diagnostic');
    expect(toCnAnalysisDiagnostic('')).toBe('');
  });
});

describe('toCnLogDetailText', () => {
  it('translates mixed timeout logs into readable Chinese', () => {
    expect(toCnLogDetailText('上传触发分析时发生系统错误: analysis timeout after 45.00s')).toBe(
      '上传后开始智能判断时等待时间过长，因此系统自动改用了备用判断。',
    );
  });

  it('translates internal terms in log details into Chinese', () => {
    expect(toCnLogDetailText('single_ai/rule_fallback/fallback/reveal')).toBe(
      '智能判断/备用判断/备用判断/录入开奖结果',
    );
  });

  it('rewrites fallback takeover wording into plain Chinese', () => {
    expect(toCnLogDetailText('单AI失败后已切换规则兜底继续下注')).toBe(
      '智能判断这次没有及时给出稳定结果，系统已经自动改用备用判断继续完成下注。',
    );
  });
});
