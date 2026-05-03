import { describe, expect, it, vi, beforeEach } from 'vitest';

import { copyText } from './clipboard';

describe('copyText', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (!('execCommand' in document)) {
      Object.defineProperty(document, 'execCommand', {
        value: () => false,
        configurable: true,
      });
    }
  });

  it('uses navigator.clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const readText = vi.fn().mockResolvedValue('hello');
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText, readText },
      configurable: true,
    });
    vi.spyOn(document, 'execCommand').mockReturnValue(false);

    const ok = await copyText('hello');
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('returns false when clipboard API resolves but content does not match', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const readText = vi.fn().mockResolvedValue('something-else');
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText, readText },
      configurable: true,
    });
    vi.spyOn(document, 'execCommand').mockReturnValue(true);

    const ok = await copyText('hello');
    expect(ok).toBe(false);
  });

  it('falls back to execCommand when clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    vi.spyOn(document, 'execCommand').mockReturnValue(true);

    const ok = await copyText('hello');
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back when clipboard API is missing', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
    vi.spyOn(document, 'execCommand').mockReturnValue(true);

    const ok = await copyText('hello');
    expect(ok).toBe(true);
  });

  it('returns false when all mechanisms fail', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
    vi.spyOn(document, 'execCommand').mockReturnValue(false);

    const ok = await copyText('hello');
    expect(ok).toBe(false);
  });
});
