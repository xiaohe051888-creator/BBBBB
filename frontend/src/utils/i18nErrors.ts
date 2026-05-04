export const toCnApiTestError = (raw: string): string => {
  const s = (raw || '').trim();
  const lower = s.toLowerCase();

  if (lower.includes("no module named 'openai'") || lower.includes('no module named "openai"')) {
    return "服务端缺少依赖 openai（后端未安装 SDK）。请更新后端环境并重启服务后重试。";
  }
  if (lower.includes("no module named 'anthropic'") || lower.includes('no module named "anthropic"')) {
    return "服务端缺少依赖 anthropic（后端未安装 SDK）。请更新后端环境并重启服务后重试。";
  }
  if (lower.includes('unknown provider')) {
    return '未知的服务商类型，请检查服务商选择是否正确。';
  }

  return s;
};

export const toCnProviderLabel = (provider?: string | null): string => {
  const key = String(provider || '').trim().toLowerCase();
  const map: Record<string, string> = {
    deepseek: '深度求索平台',
    openai: '开放AI平台',
    anthropic: '克劳德平台',
    aliyun: '阿里云通义千问',
    custom: '自定义接口',
  };
  return map[key] || '未配置服务商';
};

export const toCnModelLabel = (model?: string | null): string => {
  const key = String(model || '').trim().toLowerCase();
  const map: Record<string, string> = {
    'deepseek-v4-pro': '深度求索 V4 专业版',
    'deepseek-reasoner': '深度求索 推理增强版',
    'deepseek-chat': '深度求索 通用对话版',
    'gpt-4o': '开放AI 旗舰版',
    'gpt-4o-mini': '开放AI 轻量版',
    'claude-3-5-sonnet-20240620': '克劳德 高质量版',
    'qwen-max': '通义千问 旗舰版',
  };
  return map[key] || '自定义模型';
};

export const toCnRoadAlias = (alias?: string | null): string => {
  const key = String(alias || '').trim().toLowerCase();
  const map: Record<string, string> = {
    'big road': '大路',
    bead: '珠盘路',
    'big eye': '大眼仔路',
    small: '小路',
    cockroach: '螳螂路',
  };
  return map[key] || '';
};
