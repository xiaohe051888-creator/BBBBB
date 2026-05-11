import { describe, expect, it } from 'vitest';

import {
  DISMISS_TTL_MS,
  INSTALL_PROMPT_DISMISS_KEY,
  detectInstallPlatform,
  isDismissedRecently,
  isStandaloneDisplayMode,
} from './installPrompt';

describe('install prompt helpers', () => {
  it('detects iphone safari as manual install platform', () => {
    expect(
      detectInstallPlatform({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        hasBeforeInstallPrompt: false,
      }),
    ).toBe('ios');
  });

  it('detects install-capable android browsers when beforeinstallprompt exists', () => {
    expect(
      detectInstallPlatform({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
        hasBeforeInstallPrompt: true,
      }),
    ).toBe('android');
  });

  it('treats standalone display modes as already installed', () => {
    expect(
      isStandaloneDisplayMode({ displayModeStandalone: true, navigatorStandalone: false }),
    ).toBe(true);
    expect(
      isStandaloneDisplayMode({ displayModeStandalone: false, navigatorStandalone: true }),
    ).toBe(true);
  });

  it('uses the dismiss ttl to suppress the entry temporarily', () => {
    const now = 1_700_000_000_000;

    expect(DISMISS_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(INSTALL_PROMPT_DISMISS_KEY).toBe('pwa-install-entry-dismissed-at');
    expect(isDismissedRecently(now - 60_000, now)).toBe(true);
    expect(isDismissedRecently(now - DISMISS_TTL_MS - 1, now)).toBe(false);
    expect(isDismissedRecently(null, now)).toBe(false);
  });
});
