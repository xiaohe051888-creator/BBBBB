import { useCallback, useEffect, useMemo, useState } from 'react';

import { detectInstallPlatform, isStandaloneDisplayMode } from '../pwa/installPrompt';

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

type InstallPlatform = 'android-ready' | 'android-help' | 'ios';

type InstallResult = InstallChoice | { outcome: 'unavailable' };

export function useInstallPromptState(options: Options = {}) {
  const {
    userAgent = navigator.userAgent,
    displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches,
    navigatorStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    storage: _storage = window.localStorage,
  } = options;

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEventLike | null>(null);
  const [guideVisible, setGuideVisible] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);

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
  const visible = !installed;

  const closeGuide = useCallback(() => {
    setGuideVisible(false);
  }, []);

  const openGuide = useCallback(() => {
    setGuideVisible(true);
  }, []);

  const closeHelp = useCallback(() => {
    setHelpVisible(false);
  }, []);

  const openHelp = useCallback(() => {
    setHelpVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    setGuideVisible(false);
    setHelpVisible(false);
  }, []);

  const triggerInstall = useCallback(async (): Promise<InstallResult> => {
    if (!installEvent) {
      setHelpVisible(true);
      return { outcome: 'unavailable' };
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    return choice;
  }, [installEvent]);

  return {
    platform,
    visible,
    guideVisible,
    helpVisible,
    openGuide,
    closeGuide,
    openHelp,
    closeHelp,
    dismiss,
    triggerInstall,
  };
}
