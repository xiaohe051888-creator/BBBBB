// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstallAppHelp } from './InstallAppHelp';

describe('InstallAppHelp', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders android fallback guidance in chinese', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<InstallAppHelp visible onClose={vi.fn()} />);
    });

    expect(container.innerHTML).toContain('暂时没有返回安装能力');
    expect(container.innerHTML).toContain('安装应用');
    expect(container.innerHTML).toContain('添加到主屏幕');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
