import { describe, expect, it } from 'vitest';

import {
  MODE_SELECTED_KEY,
  clearModeSelected,
  isModeSelected,
  markModeSelected,
} from './modeSelection';

describe('modeSelection', () => {
  it('stores and reads mode_selected consistently', () => {
    localStorage.removeItem(MODE_SELECTED_KEY);
    expect(isModeSelected()).toBe(false);

    markModeSelected();
    expect(localStorage.getItem(MODE_SELECTED_KEY)).toBe('1');
    expect(isModeSelected()).toBe(true);

    clearModeSelected();
    expect(isModeSelected()).toBe(false);
  });
});
