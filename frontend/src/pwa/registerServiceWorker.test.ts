import { describe, expect, it, vi } from 'vitest';

import { registerServiceWorker } from './registerServiceWorker';

describe('registerServiceWorker', () => {
  it('registers the root service worker in production', async () => {
    const register = vi.fn().mockResolvedValue(undefined);

    await registerServiceWorker({
      isProduction: true,
      navigatorRef: { serviceWorker: { register } } as never,
      onError: vi.fn(),
    });

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('skips registration outside production', async () => {
    const register = vi.fn();

    await registerServiceWorker({
      isProduction: false,
      navigatorRef: { serviceWorker: { register } } as never,
      onError: vi.fn(),
    });

    expect(register).not.toHaveBeenCalled();
  });

  it('skips registration when service worker is unavailable', async () => {
    const onError = vi.fn();

    await expect(
      registerServiceWorker({
        isProduction: true,
        navigatorRef: {} as never,
        onError,
      }),
    ).resolves.toBeUndefined();

    expect(onError).not.toHaveBeenCalled();
  });

  it('swallows registration errors', async () => {
    const onError = vi.fn();
    const register = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(
      registerServiceWorker({
        isProduction: true,
        navigatorRef: { serviceWorker: { register } } as never,
        onError,
      }),
    ).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalled();
  });
});
