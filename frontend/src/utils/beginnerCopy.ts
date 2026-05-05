export const formatAdminModeName = (mode: 'ai' | 'single_ai' | 'rule') => {
  if (mode === 'ai') return '三模型协作模式';
  if (mode === 'single_ai') return '单AI快速模式';
  return '规则参考模式';
};

export const formatAnalysisLoadingText = (mode: 'ai' | 'single_ai' | 'rule') => {
  if (mode === 'ai') return '系统正在综合分析下一局，请稍候...';
  if (mode === 'single_ai') return '系统正在分析下一局，请稍候...';
  return '系统正在按内置规则计算，请稍候...';
};

export const formatConfidenceLabel = () => '把握度';

export const formatUploadActionLabel = (action: 'reset_current_boot' | 'new_boot') => {
  if (action === 'reset_current_boot') return '重做当前这靴数据';
  return '结束当前这靴并开始下一靴';
};

export const formatSystemStatusLabel = (
  key: 'realtime' | 'backend' | 'aiConfig' | 'tasks' | 'tasksIdle' | 'tasksAlert',
) => {
  if (key === 'realtime') return '实时连接';
  if (key === 'backend') return '服务状态';
  if (key === 'aiConfig') return '当前模式配置';
  if (key === 'tasksIdle') return '当前没有正在处理的事项';
  if (key === 'tasksAlert') return '最近有处理失败，可到管理页面查看';
  return '系统处理进度';
};

export const formatTaskAreaLabel = (key: 'tab' | 'card' | 'empty' | 'id') => {
  if (key === 'tab') return '系统处理';
  if (key === 'card') return '系统处理记录';
  if (key === 'empty') return '当前没有进行中的系统处理';
  return '处理编号';
};

export const formatMaintenanceLabel = (
  key: 'title' | 'dbSize' | 'historyLimit' | 'lastRun',
) => {
  if (key === 'title') return '数据清理与空间整理';
  if (key === 'dbSize') return '已占用空间';
  if (key === 'historyLimit') return '历史最多保留';
  return '上次手动清理';
};

export const formatLogPriorityLabel = (priority: 'P1' | 'P2' | 'P3') => {
  if (priority === 'P1') return '高优先级';
  if (priority === 'P2') return '重要';
  return '普通';
};

export const formatReviewLabel = (
  key:
    | 'pageTitle'
    | 'empty'
    | 'positiveHint'
    | 'infoTitle'
    | 'infoDescription'
    | 'totalErrors'
    | 'bankerErrors'
    | 'playerErrors'
    | 'errorTypeFilter'
    | 'directionFilter'
    | 'gameSearch',
) => {
  if (key === 'pageTitle') return '复盘记录';
  if (key === 'empty') return '暂无复盘记录';
  if (key === 'infoTitle') return '查看说明';
  if (key === 'infoDescription') {
    return '只有预测失误时，系统才会保留当时记录，方便你回看原因。';
  }
  if (key === 'totalErrors') return '累计复盘次数';
  if (key === 'bankerErrors') return '庄方向失误';
  if (key === 'playerErrors') return '闲方向失误';
  if (key === 'errorTypeFilter') return '按失误类型';
  if (key === 'directionFilter') return '按当时建议筛选';
  if (key === 'gameSearch') return '搜索局号';
  return '预测正确时，这里不会新增记录';
};

export const formatLearningLabel = (
  key:
    | 'title'
    | 'confirm'
    | 'cancel'
    | 'runningTitle'
    | 'doneTitle'
    | 'queueNotice'
    | 'manualStartHint',
) => {
  if (key === 'title') return '确认开始系统学习优化';
  if (key === 'confirm') return '立即开始优化';
  if (key === 'runningTitle') return '系统学习优化进行中';
  if (key === 'doneTitle') return '系统学习优化完成，已经可以开始新一靴';
  if (key === 'queueNotice') {
    return '系统正在整理当前学习任务，你现在上传的新数据会排队接续处理。';
  }
  if (key === 'manualStartHint') {
    return '本靴结束后，如需继续优化，请到管理页面手动开始系统学习优化';
  }
  return '暂不优化';
};

export const formatNavigationLabel = (key: 'logs' | 'mistakes') => {
  if (key === 'logs') {
    return {
      label: '运行记录',
      mobileLabel: '记录',
      desc: '查看系统运行过程',
    };
  }
  return {
    label: '复盘记录',
    mobileLabel: '复盘',
    desc: '查看失误与复盘',
  };
};

export const formatLogsLabel = (
  key: 'pageTitle' | 'detailTitle' | 'empty' | 'taskFilter',
) => {
  if (key === 'pageTitle') return '运行记录';
  if (key === 'detailTitle') return '记录详情';
  if (key === 'empty') return '暂无运行记录';
  return '按处理编号筛选';
};

export const formatDangerZoneLabel = (
  key: 'runCleanupTitle' | 'resetAllTitle' | 'resetAllButton' | 'modelVersion',
) => {
  if (key === 'runCleanupTitle') return '确认立即整理历史数据？';
  if (key === 'resetAllTitle') return '确认清空所有演示数据？';
  if (key === 'resetAllButton') return '清空演示数据';
  return '当前可用版本';
};

export const formatAdminPageLabel = (
  key: 'title' | 'learningNotNeeded' | 'learningStarted',
) => {
  if (key === 'title') return '管理页面';
  if (key === 'learningNotNeeded') return '规则参考模式下无需系统学习优化';
  return '系统学习优化已开始';
};

export const formatDetailLabel = (
  key:
    | 'copyHint'
    | 'copySummary'
    | 'whatHappened'
    | 'impact'
    | 'suggestion'
    | 'keyInfo'
    | 'rawData'
    | 'errorId'
    | 'modelSummary'
    | 'analysis'
    | 'correction'
    | 'predicted'
    | 'actual'
    | 'bankerModel'
    | 'playerModel'
    | 'combinedModel'
    | 'noAnalysis'
    | 'noCorrection',
) => {
  if (key === 'copyHint') return '一键复制下面这段通俗说明';
  if (key === 'copySummary') return '复制通俗说明';
  if (key === 'whatHappened') return '这次发生了什么';
  if (key === 'impact') return '对当前使用有什么影响';
  if (key === 'suggestion') return '建议你接下来怎么做';
  if (key === 'keyInfo') return '你可能会关心的信息';
  if (key === 'rawData') return '原始记录（高级信息）';
  if (key === 'errorId') return '记录编号';
  if (key === 'modelSummary') return 'AI分析摘要';
  if (key === 'analysis') return '原因分析';
  if (key === 'predicted') return '当时建议';
  if (key === 'actual') return '实际结果';
  if (key === 'bankerModel') return '庄方向判断';
  if (key === 'playerModel') return '闲方向判断';
  if (key === 'combinedModel') return '综合判断';
  if (key === 'noAnalysis') return '暂时没有原因分析';
  if (key === 'noCorrection') return '暂时没有改进建议';
  return '改进建议';
};
