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

type ApiErrorDetailItem = {
  msg?: unknown;
};

type ApiErrorLike = {
  response?: { data?: { detail?: unknown; error?: unknown } };
  message?: unknown;
};

const detailToText = (detail: unknown): string | null => {
  if (typeof detail === 'string') {
    const normalized = normalizeBackendDetail(detail);
    return normalized || detail;
  }

  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) {
          const msg = (item as ApiErrorDetailItem).msg;
          return typeof msg === 'string' ? msg : null;
        }
        return null;
      })
      .filter((item): item is string => !!item);

    return parts.length > 0 ? parts.join('；') : null;
  }

  if (detail && typeof detail === 'object' && 'msg' in detail) {
    const msg = (detail as ApiErrorDetailItem).msg;
    return typeof msg === 'string' ? msg : null;
  }

  return null;
};

export const formatApiErrorMessage = (error: unknown, fallback: string): string => {
  const err = error as ApiErrorLike;
  return (
    detailToText(err?.response?.data?.detail) ||
    detailToText(err?.response?.data?.error) ||
    (typeof err?.message === 'string' && err.message.trim()) ||
    fallback
  );
};
