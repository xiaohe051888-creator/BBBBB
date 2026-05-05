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
