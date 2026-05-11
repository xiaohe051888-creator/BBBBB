import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  INSTALL_PROMPT_DISMISS_KEY,
  detectInstallPlatform,
  isDismissedRecently,
  isStandaloneDisplayMode,
} from '../pwa/installPrompt';

type InstallChoice = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type InstallPromptStorage = Pick<Storage, 'getItem' | 'setItem'>;

type Options = {
  userAgent?: string;
  displayModeStandalone?: boolean;
  navigatorStandalone?: boolean;
  storage?: InstallPromptStorage;
};

type InstallPlatform = 'android' | 'ios' | 'none';

type InstallResult = InstallChoice | { outcome: 'unavailable' };

function readDismissedAt(storage: InstallPromptStorage): number | null {
  const rawValue = storage.getItem(INSTALL_PROMPT_DISMISS_KEY);
  if (!rawValue) {
    return null;
  }

  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

export function useInstallPromptState(options: Options = {}) {
  const {
    userAgent = navigator.userAgent,
    displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches,
    navigatorStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    storage = window.localStorage,
  } = options;

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEventLike | null>(null);
  const [guideVisible, setGuideVisible] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<number | null>(() => readDismissedAt(storage));

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEventLike;
      promptEvent.preventDefault();
      setInstallEvent(promptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, []);

  const platform = useMemo<InstallPlatform>(
    () =>
      detectInstallPlatform({
        userAgent,
        hasBeforeInstallPrompt: Boolean(installEvent),
      }),
    [installEvent, userAgent],
  );

  const installed = isStandaloneDisplayMode({
    displayModeStandalone,
    navigatorStandalone,
  });
  const visible = !installed && platform !== 'none' && !isDismissedRecently(dismissedAt);

  const closeGuide = useCallback(() => {
    setGuideVisible(false);
  }, []);

  const openGuide = useCallback(() => {
    setGuideVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    const now = Date.now();
    storage.setItem(INSTALL_PROMPT_DISMISS_KEY, String(now));
    setDismissedAt(now);
    setGuideVisible(false);
  }, [storage]);

  const triggerInstall = useCallback(async (): Promise<InstallResult> => {
    if (!installEvent) {
      return { outcome: 'unavailable' };
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;

    if (choice.outcome === 'accepted') {
      dismiss();
    }

    return choice;
  }, [dismiss, installEvent]);

  return {
    platform,
    visible,
    guideVisible,
    openGuide,
    closeGuide,
    dismiss,
    triggerInstall,
  };
}
