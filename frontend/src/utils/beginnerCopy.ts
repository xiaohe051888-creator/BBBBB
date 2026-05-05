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
  key: 'realtime' | 'backend' | 'aiConfig' | 'tasks',
) => {
  if (key === 'realtime') return '实时连接';
  if (key === 'backend') return '服务状态';
  if (key === 'aiConfig') return '当前模式配置';
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

export const formatReviewLabel = (key: 'pageTitle' | 'empty' | 'positiveHint') => {
  if (key === 'pageTitle') return '复盘记录';
  if (key === 'empty') return '暂无复盘记录';
  return '预测正确时，这里不会新增记录';
};

export const formatLearningLabel = (key: 'title' | 'confirm' | 'cancel') => {
  if (key === 'title') return '确认开始系统学习优化';
  if (key === 'confirm') return '立即开始优化';
  return '暂不优化';
};
