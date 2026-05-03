import { describe, expect, it } from 'vitest';

import { shouldCloseApiConfigModalAfterSave } from './apiConfigFlow';

describe('apiConfigFlow', () => {
  it('keeps ApiConfigModal open after saving', () => {
    expect(shouldCloseApiConfigModalAfterSave()).toBe(false);
  });
});

