import { describe, expect, it } from 'vitest';

import {
  formatAdminModeName,
  formatAnalysisLoadingText,
  formatConfidenceLabel,
  formatDangerZoneLabel,
  formatDetailLabel,
  formatLearningLabel,
  formatNavigationLabel,
  formatLogPriorityLabel,
  formatLogsLabel,
  formatMaintenanceLabel,
  formatReviewLabel,
  formatSystemStatusLabel,
  formatTaskAreaLabel,
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

  it('formats task area labels in plain language', () => {
    expect(formatTaskAreaLabel('tab')).toBe('系统处理');
    expect(formatTaskAreaLabel('card')).toBe('系统处理记录');
    expect(formatTaskAreaLabel('empty')).toBe('当前没有进行中的系统处理');
    expect(formatTaskAreaLabel('id')).toBe('处理编号');
  });

  it('formats maintenance labels in plain language', () => {
    expect(formatMaintenanceLabel('title')).toBe('数据清理与空间整理');
    expect(formatMaintenanceLabel('dbSize')).toBe('已占用空间');
    expect(formatMaintenanceLabel('historyLimit')).toBe('历史最多保留');
    expect(formatMaintenanceLabel('lastRun')).toBe('上次手动清理');
  });

  it('formats log priority labels in plain language', () => {
    expect(formatLogPriorityLabel('P1')).toBe('高优先级');
    expect(formatLogPriorityLabel('P2')).toBe('重要');
    expect(formatLogPriorityLabel('P3')).toBe('普通');
  });

  it('formats review-area labels in plain language', () => {
    expect(formatReviewLabel('pageTitle')).toBe('复盘记录');
    expect(formatReviewLabel('empty')).toBe('暂无复盘记录');
    expect(formatReviewLabel('positiveHint')).toBe('预测正确时，这里不会新增记录');
  });

  it('formats learning labels in plain language', () => {
    expect(formatLearningLabel('title')).toBe('确认开始系统学习优化');
    expect(formatLearningLabel('confirm')).toBe('立即开始优化');
    expect(formatLearningLabel('cancel')).toBe('暂不优化');
  });

  it('formats navigation labels in plain language', () => {
    expect(formatNavigationLabel('logs')).toEqual({
      label: '运行记录',
      mobileLabel: '记录',
      desc: '查看系统运行过程',
    });
    expect(formatNavigationLabel('mistakes')).toEqual({
      label: '复盘记录',
      mobileLabel: '复盘',
      desc: '查看失误与复盘',
    });
  });

  it('formats logs page labels in plain language', () => {
    expect(formatLogsLabel('pageTitle')).toBe('运行记录');
    expect(formatLogsLabel('detailTitle')).toBe('记录详情');
    expect(formatLogsLabel('empty')).toBe('暂无运行记录');
    expect(formatLogsLabel('taskFilter')).toBe('按处理编号筛选');
  });

  it('formats admin danger-zone labels in plain language', () => {
    expect(formatDangerZoneLabel('runCleanupTitle')).toBe('确认立即整理历史数据？');
    expect(formatDangerZoneLabel('resetAllTitle')).toBe('确认清空所有演示数据？');
    expect(formatDangerZoneLabel('resetAllButton')).toBe('清空演示数据');
    expect(formatDangerZoneLabel('modelVersion')).toBe('当前可用版本');
  });

  it('formats detail labels in plain language', () => {
    expect(formatDetailLabel('copyHint')).toBe('一键复制下面这段通俗说明');
    expect(formatDetailLabel('whatHappened')).toBe('这次发生了什么');
    expect(formatDetailLabel('impact')).toBe('对当前使用有什么影响');
    expect(formatDetailLabel('suggestion')).toBe('建议你接下来怎么做');
    expect(formatDetailLabel('keyInfo')).toBe('你可能会关心的信息');
    expect(formatDetailLabel('rawData')).toBe('原始记录（高级信息）');
    expect(formatDetailLabel('errorId')).toBe('记录编号');
    expect(formatDetailLabel('modelSummary')).toBe('AI分析摘要');
    expect(formatDetailLabel('analysis')).toBe('原因分析');
    expect(formatDetailLabel('correction')).toBe('改进建议');
  });
});
