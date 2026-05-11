// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstallAppEntry } from './InstallAppEntry';

describe('InstallAppEntry', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('shows android install action and triggers prompt callback', async () => {
    const onInstall = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <InstallAppEntry
          visible
          platform="android-ready"
          guideVisible={false}
          helpVisible={false}
          onInstall={onInstall}
          onOpenGuide={vi.fn()}
          onCloseGuide={vi.fn()}
          onOpenHelp={vi.fn()}
          onCloseHelp={vi.fn()}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll('button')).find((node) =>
      (node.textContent || '').includes('安装 App'),
    );
    expect(button).toBeTruthy();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onInstall).toHaveBeenCalledTimes(1);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('shows ios wording and opens the guide instead of triggering install', async () => {
    const onOpenGuide = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <InstallAppEntry
          visible
          platform="ios"
          guideVisible={false}
          helpVisible={false}
          onInstall={vi.fn()}
          onOpenGuide={onOpenGuide}
          onCloseGuide={vi.fn()}
          onOpenHelp={vi.fn()}
          onCloseHelp={vi.fn()}
        />,
      );
    });

    const html = container.innerHTML;
    expect(html).toContain('安装到桌面');
    expect(html).toContain('像 App 一样打开');

    const button = Array.from(container.querySelectorAll('button')).find((node) =>
      (node.textContent || '').includes('安装到桌面'),
    );
    expect(button).toBeTruthy();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onOpenGuide).toHaveBeenCalledTimes(1);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('shows android help instead of doing nothing when install is unavailable', async () => {
    const onOpenHelp = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <InstallAppEntry
          visible
          platform="android-help"
          guideVisible={false}
          helpVisible={false}
          onInstall={vi.fn()}
          onOpenGuide={vi.fn()}
          onCloseGuide={vi.fn()}
          onOpenHelp={onOpenHelp}
          onCloseHelp={vi.fn()}
        />,
      );
    });

    const button = Array.from(container.querySelectorAll('button')).find((node) =>
      (node.textContent || '').includes('安装 App'),
    );
    expect(button).toBeTruthy();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onOpenHelp).toHaveBeenCalledTimes(1);
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
