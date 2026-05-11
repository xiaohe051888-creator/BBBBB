import { describe, expect, it } from 'vitest';

import { detectInstallPlatform, isStandaloneDisplayMode } from './installPrompt';

describe('detectInstallPlatform', () => {
  it('returns ios for iphone safari', () => {
    expect(
      detectInstallPlatform({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        hasBeforeInstallPrompt: false,
      }),
    ).toBe('ios');
  });

  it('returns android-ready when beforeinstallprompt is available', () => {
    expect(
      detectInstallPlatform({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        hasBeforeInstallPrompt: true,
      }),
    ).toBe('android-ready');
  });

  it('returns android-help when android has no install event yet', () => {
    expect(
      detectInstallPlatform({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        hasBeforeInstallPrompt: false,
      }),
    ).toBe('android-help');
  });
});

describe('isStandaloneDisplayMode', () => {
  it('returns true when standalone display mode is active', () => {
    expect(
      isStandaloneDisplayMode({
        displayModeStandalone: true,
        navigatorStandalone: false,
      }),
    ).toBe(true);
  });
});
