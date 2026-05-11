import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useInstallPromptState } from './useInstallPromptState';

describe('useInstallPromptState', () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function renderHookWithValue(options?: Parameters<typeof useInstallPromptState>[0]) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let latest: ReturnType<typeof useInstallPromptState> | null = null;

    const Probe = ({
      onValue,
    }: {
      onValue: (value: ReturnType<typeof useInstallPromptState>) => void;
    }) => {
      const value = useInstallPromptState(options);

      React.useEffect(() => {
        onValue(value);
      }, [onValue, value]);

      return null;
    };

    act(() => {
      root.render(
        React.createElement(Probe, {
          onValue: (value: ReturnType<typeof useInstallPromptState>) => {
            latest = value;
          },
        }),
      );
    });

    return {
      getLatest: () => latest,
      cleanup: () =>
        act(() => {
          root.unmount();
          container.remove();
        }),
    };
  }

  it('shows android install entry only after beforeinstallprompt is captured', () => {
    const hook = renderHookWithValue({
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
      displayModeStandalone: false,
      navigatorStandalone: false,
      storage: localStorage,
    });

    expect(hook.getLatest()?.platform).toBe('none');
    expect(hook.getLatest()?.visible).toBe(false);

    const event = new Event('beforeinstallprompt');
    Object.assign(event, {
      preventDefault: vi.fn(),
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(hook.getLatest()?.platform).toBe('android');
    expect(hook.getLatest()?.visible).toBe(true);
    hook.cleanup();
  });

  it('shows ios entry without beforeinstallprompt and opens guide on demand', () => {
    const hook = renderHookWithValue({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      displayModeStandalone: false,
      navigatorStandalone: false,
      storage: localStorage,
    });

    expect(hook.getLatest()?.platform).toBe('ios');
    expect(hook.getLatest()?.visible).toBe(true);

    act(() => {
      hook.getLatest()?.openGuide();
    });

    expect(hook.getLatest()?.guideVisible).toBe(true);
    hook.cleanup();
  });

  it('hides the entry when already running in standalone mode', () => {
    const hook = renderHookWithValue({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      displayModeStandalone: true,
      navigatorStandalone: false,
      storage: localStorage,
    });

    expect(hook.getLatest()?.platform).toBe('ios');
    expect(hook.getLatest()?.visible).toBe(false);
    hook.cleanup();
  });

  it('dismisses the entry, persists cooldown, and closes the guide', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    const hook = renderHookWithValue({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      displayModeStandalone: false,
      navigatorStandalone: false,
      storage: localStorage,
    });

    act(() => {
      hook.getLatest()?.openGuide();
      hook.getLatest()?.dismiss();
    });

    expect(hook.getLatest()?.guideVisible).toBe(false);
    expect(hook.getLatest()?.visible).toBe(false);
    expect(localStorage.getItem('pwa-install-entry-dismissed-at')).toBe('1700000000000');
    hook.cleanup();
  });

  it('prompts install on android and hides after the user accepts', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_123);

    const hook = renderHookWithValue({
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
      displayModeStandalone: false,
      navigatorStandalone: false,
      storage: localStorage,
    });

    const event = new Event('beforeinstallprompt');
    const prompt = vi.fn().mockResolvedValue(undefined);
    Object.assign(event, {
      preventDefault: vi.fn(),
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });

    act(() => {
      window.dispatchEvent(event);
    });

    await act(async () => {
      await hook.getLatest()?.triggerInstall();
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(hook.getLatest()?.visible).toBe(false);
    expect(localStorage.getItem('pwa-install-entry-dismissed-at')).toBe('1700000000123');
    hook.cleanup();
  });
});
