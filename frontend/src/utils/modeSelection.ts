export const MODE_SELECTED_KEY = 'mode_selected';

export const isModeSelected = (): boolean =>
  localStorage.getItem(MODE_SELECTED_KEY) === '1';

export const markModeSelected = (): void => {
  localStorage.setItem(MODE_SELECTED_KEY, '1');
};

export const clearModeSelected = (): void => {
  localStorage.removeItem(MODE_SELECTED_KEY);
};
