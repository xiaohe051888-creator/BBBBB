import { describe, expect, it, beforeEach, vi } from 'vitest';

import { clearToken, getToken, setToken, handleApiError } from './api';

const setLocation = (pathname: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  delete w.location;
  w.location = {
    pathname,
    assign: vi.fn(),
  };
  return w.location.assign as ReturnType<typeof vi.fn>;
};

describe('api interceptor handleApiError', () => {
  beforeEach(() => {
    localStorage.clear();
    clearToken();
  });

  it('redirects to /mode?session_expired=true only when a token existed', async () => {
    setToken('token');
    expect(getToken()).toBe('token');
    const assign = setLocation('/dashboard/logs');

    try {
      await handleApiError({
        response: { status: 401, data: { detail: 'unauthorized' } },
        config: { url: '/logs' },
      });
    } catch {
      // expected
    }

    expect(getToken()).toBe(null);
    expect(assign).toHaveBeenCalledWith('/login?session_expired=true');
  });

  it('does not redirect when there is no token', async () => {
    expect(getToken()).toBe(null);
    const assign = setLocation('/dashboard/logs');

    try {
      await handleApiError({
        response: { status: 401, data: { detail: 'unauthorized' } },
        config: { url: '/logs' },
      });
    } catch {
      // expected
    }

    expect(assign).not.toHaveBeenCalled();
  });

  it('uses beginner-friendly wording for network errors', async () => {
    await expect(
      handleApiError({
        message: 'Network Error',
        config: { url: '/system-state' },
      }),
    ).rejects.toMatchObject({
      message: '网络连接失败，请检查系统服务是否正常运行',
    });
  });
});
