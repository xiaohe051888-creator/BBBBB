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
}: DetectInstallPlatformArgs): 'android-ready' | 'android-help' | 'ios' {
  const ua = userAgent.toLowerCase();
  const isIphone = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|edgios|chrome/.test(ua);
  const isAndroid = /android/.test(ua);

  if (isIphone && isSafari) {
    return 'ios';
  }

  if (isAndroid && hasBeforeInstallPrompt) {
    return 'android-ready';
  }

  return 'android-help';
}

export function isStandaloneDisplayMode({
  displayModeStandalone,
  navigatorStandalone,
}: StandaloneArgs): boolean {
  return displayModeStandalone || navigatorStandalone;
}
