// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstallAppGuide } from './InstallAppGuide';

describe('InstallAppGuide', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders the three-step iphone install instructions', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<InstallAppGuide visible onClose={vi.fn()} />);
    });

    const html = container.innerHTML;
    expect(html).toContain('安装到桌面');
    expect(html).toContain('点击 Safari 的分享按钮');
    expect(html).toContain('选择“添加到主屏幕”');
    expect(html).toContain('从桌面像 App 一样打开');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
