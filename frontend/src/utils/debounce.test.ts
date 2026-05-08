import { describe, expect, it, vi } from 'vitest';

import { debounce } from './debounce';

describe('debounce', () => {
  it('runs only once with the latest arguments after wait', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced('a');
    debounced('b');
    debounced('c');

    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');

    vi.useRealTimers();
  });

  it('cancels pending invocation', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced('a');
    debounced.cancel();
    vi.advanceTimersByTime(250);

    expect(fn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
