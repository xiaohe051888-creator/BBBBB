import { useCallback, useEffect, useState } from 'react';

import { isStandaloneDisplayMode } from '../pwa/installPrompt';

type InstallChoice = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type Options = {
  displayModeStandalone?: boolean;
  navigatorStandalone?: boolean;
};

type InstallResult = InstallChoice | { outcome: 'unavailable' };

export function useInstallPromptState(options: Options = {}) {
  const {
    displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches,
    navigatorStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  } = options;

  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEventLike | null>(null);

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

  const installed = isStandaloneDisplayMode({
    displayModeStandalone,
    navigatorStandalone,
  });
  const visible = !installed;

  const triggerInstall = useCallback(async (): Promise<InstallResult> => {
    if (!installEvent) {
      return { outcome: 'unavailable' };
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    return choice;
  }, [installEvent]);

  return {
    visible,
    triggerInstall,
  };
}
