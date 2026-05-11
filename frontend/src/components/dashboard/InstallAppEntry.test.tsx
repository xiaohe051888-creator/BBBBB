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

  it('renders only one install button when visible', async () => {
    const onInstall = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<InstallAppEntry visible onInstall={onInstall} />);
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons).toHaveLength(1);
    expect(container.innerHTML).toContain('安装 App');
    expect(container.innerHTML).not.toContain('像 App 一样打开');
    expect(container.innerHTML).not.toContain('安装到桌面');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('calls install handler when clicked', async () => {
    const onInstall = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<InstallAppEntry visible onInstall={onInstall} />);
    });

    const button = container.querySelector('button');
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onInstall).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
