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
  return map[key] || '暂未选择服务商';
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

export const toCnLogDetailText = (raw?: string | null): string => {
  let s = String(raw || '').trim();
  const lower = s.toLowerCase();

  if (!s) {
    return '';
  }

  if (
    lower.includes('上传触发分析时发生系统错误') &&
    lower.includes('analysis timeout after')
  ) {
    return '上传后开始智能判断时等待时间过长，因此系统自动改用了备用判断。';
  }

  if (
    s.includes('单AI失败后已切换规则兜底继续下注') ||
    lower.includes('fallback to rule') ||
    ((lower.includes('single_ai') || s.includes('单AI')) &&
      (lower.includes('rule_fallback') || s.includes('规则兜底')) &&
      (s.includes('继续下注') || lower.includes('bet')))
  ) {
    return '智能判断这次没有及时给出稳定结果，系统已经自动改用备用判断继续完成下注。';
  }

  if (lower.includes('analysis timeout after') || lower === 'timeout') {
    return '智能判断等待时间过长。';
  }

  const replacements: Array<[RegExp, string]> = [
    [/\bsingle_ai\b/gi, '智能判断'],
    [/\bAI\b/g, '智能判断'],
    [/单AI/g, '智能判断'],
    [/\brule_fallback\b/gi, '备用判断'],
    [/规则兜底/g, '备用判断'],
    [/\bfallback\b/gi, '备用判断'],
    [/\breveal\b/gi, '录入开奖结果'],
    [/开牌/g, '录入开奖结果'],
  ];

  for (const [pattern, replacement] of replacements) {
    s = s.replace(pattern, replacement);
  }

  return s;
};

export const toCnAnalysisDiagnostic = (raw?: string | null): string => {
  const s = String(raw || '').trim();
  const lower = s.toLowerCase();
  const translated = toCnLogDetailText(s);

  if (!translated) {
    return '';
  }

  const isFallbackDiagnostic =
    lower.includes('analysis timeout after 45.00s') ||
    lower.includes('rule_fallback') ||
    lower.includes('fallback to rule') ||
    lower.includes('fallback') ||
    lower.includes('timeout') ||
    lower.includes('single_ai') ||
    translated.includes('备用判断') ||
    translated.includes('智能判断这次没有及时给出稳定结果');

  if (isFallbackDiagnostic) {
    return '智能判断这次没有及时给出稳定结果，系统先用备用判断继续完成这次判断。';
  }

  return translated;
};
