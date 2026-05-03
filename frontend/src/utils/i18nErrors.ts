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

