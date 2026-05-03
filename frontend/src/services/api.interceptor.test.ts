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

  it('redirects to /?session_expired=true only when a token existed', async () => {
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
    expect(assign).toHaveBeenCalledWith('/?session_expired=true');
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
});

