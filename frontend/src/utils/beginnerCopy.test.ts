import { describe, expect, it } from 'vitest';

import {
  formatAdminPageLabel,
  formatAdminModeName,
  formatAnalysisLoadingText,
  formatConfigStatusLabel,
  formatConfidenceLabel,
  formatDangerZoneLabel,
  formatDetailLabel,
  formatLearningLabel,
  formatModeSelectLabel,
  formatNavigationLabel,
  formatLogPriorityLabel,
  formatLogsLabel,
  formatMaintenanceLabel,
  formatReviewLabel,
  formatSystemStatusLabel,
  formatTaskAreaLabel,
  formatUploadLabel,
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
    expect(formatUploadLabel('submitMode')).toBe('上传方式');
    expect(formatUploadLabel('summaryTitle')).toBe('这次会做什么');
    expect(formatUploadLabel('queueHint')).toBe('系统正在优化中。为了不打断当前流程，现在只能先结束这靴，再把这次上传排队接着处理。');
    expect(formatUploadLabel('resetImpact')).toBe('将清空当前这靴的记录、下注、复盘记录、路图和相关运行状态');
  });

  it('formats system status labels in plain language', () => {
    expect(formatSystemStatusLabel('realtime')).toBe('实时连接');
    expect(formatSystemStatusLabel('backend')).toBe('服务状态');
    expect(formatSystemStatusLabel('aiConfig')).toBe('当前模式配置');
    expect(formatSystemStatusLabel('tasks')).toBe('系统处理进度');
    expect(formatSystemStatusLabel('tasksIdle')).toBe('当前没有正在处理的事项');
    expect(formatSystemStatusLabel('tasksAlert')).toBe('最近有处理失败，可到管理页面查看');
    expect(formatSystemStatusLabel('backendApi')).toBe('服务接口');
    expect(formatSystemStatusLabel('aiReady')).toBe('当前模式已就绪');
    expect(formatSystemStatusLabel('aiNotReady')).toBe('当前模式尚未就绪');
    expect(formatSystemStatusLabel('activeIssues')).toBe('当前需要留意的问题');
    expect(formatSystemStatusLabel('backendOfflineHint')).toBe('请确认系统服务已经启动');
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
    expect(formatReviewLabel('infoTitle')).toBe('查看说明');
    expect(formatReviewLabel('infoDescription')).toBe('只有预测失误时，系统才会保留当时记录，方便你回看原因。');
    expect(formatReviewLabel('totalErrors')).toBe('累计复盘次数');
    expect(formatReviewLabel('bankerErrors')).toBe('庄方向失误');
    expect(formatReviewLabel('playerErrors')).toBe('闲方向失误');
    expect(formatReviewLabel('errorTypeFilter')).toBe('按失误类型');
    expect(formatReviewLabel('errorTypeColumn')).toBe('失误类型');
    expect(formatReviewLabel('directionFilter')).toBe('按当时建议筛选');
    expect(formatReviewLabel('gameSearch')).toBe('搜索局号');
  });

  it('formats learning labels in plain language', () => {
    expect(formatLearningLabel('title')).toBe('确认开始系统学习优化');
    expect(formatLearningLabel('confirm')).toBe('立即开始优化');
    expect(formatLearningLabel('cancel')).toBe('暂不优化');
    expect(formatLearningLabel('runningTitle')).toBe('系统学习优化进行中');
    expect(formatLearningLabel('doneTitle')).toBe('系统学习优化完成，已经可以开始新一靴');
    expect(formatLearningLabel('queueNotice')).toBe('系统正在整理当前学习任务，你现在上传的新数据会排队接续处理。');
    expect(formatLearningLabel('manualStartHint')).toBe('本靴结束后，如需继续优化，请到管理页面手动开始系统学习优化');
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

  it('formats mode-select labels in plain language', () => {
    expect(formatModeSelectLabel('pageHint')).toBe('先选好使用方式，再进入系统主界面；需要 AI 时，请先完成设置并确认可用。');
    expect(formatModeSelectLabel('aiCardTitle')).toBe('三模型协作模式（3个AI一起判断）');
    expect(formatModeSelectLabel('singleCardTitle')).toBe('单AI快速模式（使用你当前设置的单AI）');
    expect(formatModeSelectLabel('ruleCardTitle')).toBe('规则参考模式（无需额外设置）');
    expect(formatModeSelectLabel('ruleCardHint')).toBe('按内置规则直接给参考结果，不需要额外设置，随时可用。');
    expect(formatModeSelectLabel('notConfigured')).toBe('还没完成设置');
    expect(formatModeSelectLabel('notReady')).toBe('还不能正常使用');
  });

  it('formats logs page labels in plain language', () => {
    expect(formatLogsLabel('pageTitle')).toBe('运行记录');
    expect(formatLogsLabel('detailTitle')).toBe('记录详情');
    expect(formatLogsLabel('empty')).toBe('暂无运行记录');
    expect(formatLogsLabel('taskFilter')).toBe('按处理编号筛选');
    expect(formatLogsLabel('copyTaskId')).toBe('复制处理编号');
    expect(formatLogsLabel('taskIdCopied')).toBe('处理编号已复制');
  });

  it('formats admin danger-zone labels in plain language', () => {
    expect(formatDangerZoneLabel('runCleanupTitle')).toBe('确认立即整理历史数据？');
    expect(formatDangerZoneLabel('resetAllTitle')).toBe('确认清空所有演示数据？');
    expect(formatDangerZoneLabel('resetAllButton')).toBe('清空演示数据');
    expect(formatDangerZoneLabel('modelVersion')).toBe('当前可用版本');
  });

  it('formats admin page labels in plain language', () => {
    expect(formatAdminPageLabel('title')).toBe('管理页面');
    expect(formatAdminPageLabel('learningNotNeeded')).toBe('规则参考模式下无需系统学习优化');
    expect(formatAdminPageLabel('learningStarted')).toBe('系统学习优化已开始');
    expect(formatAdminPageLabel('rechargeHint')).toBe('请到管理页面充值');
  });

  it('formats config-status labels in plain language', () => {
    expect(formatConfigStatusLabel('unset')).toBe('未完成设置');
    expect(formatConfigStatusLabel('set')).toBe('已完成设置');
    expect(formatConfigStatusLabel('openConfig')).toBe('设置接口');
    expect(formatConfigStatusLabel('missing')).toBe('还没设置');
    expect(formatConfigStatusLabel('notReady')).toBe('还不能正常使用');
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
    expect(formatDetailLabel('predicted')).toBe('当时建议');
    expect(formatDetailLabel('actual')).toBe('实际结果');
    expect(formatDetailLabel('bankerModel')).toBe('庄方向判断');
    expect(formatDetailLabel('playerModel')).toBe('闲方向判断');
    expect(formatDetailLabel('combinedModel')).toBe('综合判断');
    expect(formatDetailLabel('noAnalysis')).toBe('暂时没有原因分析');
    expect(formatDetailLabel('noCorrection')).toBe('暂时没有改进建议');
    expect(formatDetailLabel('copySummary')).toBe('复制通俗说明');
  });
});
