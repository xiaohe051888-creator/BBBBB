export const normalizeBackendDetail = (detail: unknown): string | null => {
  if (typeof detail !== 'string') return null;

  const code = detail.trim();
  if (!code) return null;

  const map: Record<string, string> = {
    illegal_state: '当前状态不允许该操作，请刷新后重试',
    stale_boot: '系统状态已变化，请刷新后重试',
    unauthorized: '登录已过期，请重新登录',
  };

  return map[code] || null;
};

