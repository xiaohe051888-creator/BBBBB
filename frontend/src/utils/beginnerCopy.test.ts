import { describe, expect, it } from 'vitest';

import {
  formatAdminModeName,
  formatAnalysisLoadingText,
  formatConfidenceLabel,
  formatSystemStatusLabel,
  formatUploadActionLabel,
} from './beginnerCopy';

describe('beginnerCopy', () => {
  it('formats mode names for beginners', () => {
    expect(formatAdminModeName('ai')).toBe('三模型协作模式');
    expect(formatAdminModeName('single_ai')).toBe('单AI快速模式');
    expect(formatAdminModeName('rule')).toBe('规则参考模式');
  });

  it('formats analysis loading messages in plain language', () => {
    expect(formatAnalysisLoadingText('ai')).toBe('系统正在综合分析下一局，请稍候...');
    expect(formatAnalysisLoadingText('single_ai')).toBe('系统正在分析下一局，请稍候...');
    expect(formatAnalysisLoadingText('rule')).toBe('系统正在按内置规则计算，请稍候...');
  });

  it('uses a beginner-friendly confidence label', () => {
    expect(formatConfidenceLabel()).toBe('把握度');
  });

  it('formats upload action labels in plain language', () => {
    expect(formatUploadActionLabel('reset_current_boot')).toBe('重做当前这靴数据');
    expect(formatUploadActionLabel('new_boot')).toBe('结束当前这靴并开始下一靴');
  });

  it('formats system status labels in plain language', () => {
    expect(formatSystemStatusLabel('realtime')).toBe('实时连接');
    expect(formatSystemStatusLabel('backend')).toBe('服务状态');
    expect(formatSystemStatusLabel('aiConfig')).toBe('当前模式配置');
    expect(formatSystemStatusLabel('tasks')).toBe('系统处理进度');
  });
});
