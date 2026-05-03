import { describe, expect, it } from 'vitest';

import { formatBeijing } from './datetime';

describe('datetime', () => {
  it('formats Z time into Beijing time', () => {
    expect(formatBeijing('2026-05-03T00:00:00Z', 'YYYY-MM-DD HH:mm:ss')).toBe('2026-05-03 08:00:00');
  });

  it('treats naive time as UTC and converts to Beijing', () => {
    expect(formatBeijing('2026-05-03 00:00:00', 'YYYY-MM-DD HH:mm:ss')).toBe('2026-05-03 08:00:00');
  });
});

