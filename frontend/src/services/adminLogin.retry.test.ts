import { beforeEach, describe, expect, it, vi } from 'vitest';

const postMock = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: () => ({
      post: postMock,
      get: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }),
  },
}));

describe('adminLogin gateway retry', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('retries once when the admin login request gets a gateway error', async () => {
    postMock
      .mockRejectedValueOnce({ response: { status: 502 }, config: { url: '/admin/login' } })
      .mockResolvedValueOnce({ data: { token: 'ok' } });

    const { adminLogin } = await import('./api');
    const res = await adminLogin('8888', 'admin');

    expect(postMock).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ data: { token: 'ok' } });
  });
});
