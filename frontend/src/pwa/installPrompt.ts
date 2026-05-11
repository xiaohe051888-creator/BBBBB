export const INSTALL_PROMPT_DISMISS_KEY = 'pwa-install-entry-dismissed-at';
export const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type DetectInstallPlatformArgs = {
  userAgent: string;
  hasBeforeInstallPrompt: boolean;
};

type StandaloneArgs = {
  displayModeStandalone: boolean;
  navigatorStandalone: boolean;
};

export function detectInstallPlatform({
  userAgent,
  hasBeforeInstallPrompt,
}: DetectInstallPlatformArgs): 'android' | 'ios' | 'none' {
  const ua = userAgent.toLowerCase();
  const isIphone = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|chrome/.test(ua);
  const isAndroid = /android/.test(ua);

  if (isIphone && isSafari) {
    return 'ios';
  }

  if (isAndroid && hasBeforeInstallPrompt) {
    return 'android';
  }

  return 'none';
}

export function isStandaloneDisplayMode({
  displayModeStandalone,
  navigatorStandalone,
}: StandaloneArgs): boolean {
  return displayModeStandalone || navigatorStandalone;
}

export function isDismissedRecently(lastDismissedAt: number | null, now = Date.now()): boolean {
  if (!lastDismissedAt) {
    return false;
  }

  return now - lastDismissedAt < DISMISS_TTL_MS;
}
