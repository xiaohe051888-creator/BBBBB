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

  it('returns visible when app is not installed', () => {
    const hook = renderHookWithValue({
      displayModeStandalone: false,
      navigatorStandalone: false,
    });

    expect(hook.getLatest()?.visible).toBe(true);
    expect(typeof hook.getLatest()?.triggerInstall).toBe('function');
    expect(hook.getLatest()).not.toHaveProperty('platform');
    expect(hook.getLatest()).not.toHaveProperty('helpVisible');
    expect(hook.getLatest()).not.toHaveProperty('guideVisible');
    hook.cleanup();
  });

  it('hides entry when already installed', () => {
    const hook = renderHookWithValue({
      displayModeStandalone: true,
      navigatorStandalone: false,
    });

    expect(hook.getLatest()?.visible).toBe(false);
    hook.cleanup();
  });

  it('returns unavailable when install event does not exist', async () => {
    const hook = renderHookWithValue({
      displayModeStandalone: false,
      navigatorStandalone: false,
    });

    await act(async () => {
      const choice = await hook.getLatest()?.triggerInstall();
      expect(choice?.outcome).toBe('unavailable');
    });

    hook.cleanup();
  });
});
