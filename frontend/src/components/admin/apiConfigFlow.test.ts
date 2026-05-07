import { describe, expect, it } from 'vitest';

import { shouldCloseApiConfigModalAfterSave } from './apiConfigFlow';

describe('apiConfigFlow', () => {
  it('closes ApiConfigModal after saving succeeds', () => {
    expect(shouldCloseApiConfigModalAfterSave()).toBe(true);
  });
});
