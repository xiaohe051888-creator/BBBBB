// @vitest-environment jsdom
import React from 'react';
import { App } from 'antd';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import ModeSelectPage from './ModeSelectPage';
import * as api from '../services/api';

describe('ModeSelectPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('shows an explicit expired-session notice from the query string', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(api, 'getThreeModelStatus').mockResolvedValue({
      data: {
        ai_ready_for_enable: false,
        single_ai_ready_for_enable: false,
        models: {},
      },
    } as Awaited<ReturnType<typeof api.getThreeModelStatus>>);
    vi.spyOn(api, 'getSystemStatePublic').mockResolvedValue({
      data: {
        prediction_mode: 'rule',
      },
    } as Awaited<ReturnType<typeof api.getSystemStatePublic>>);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <App>
          <MemoryRouter initialEntries={['/mode?session_expired=true']}>
            <ModeSelectPage />
          </MemoryRouter>
        </App>
      );
    });

    expect(container.innerHTML).toContain('登录已过期');
    expect(container.innerHTML).toContain('请重新选择模式后再进入系统');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('marks the current mode and disables re-enabling it', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(api, 'getThreeModelStatus').mockResolvedValue({
      data: {
        ai_ready_for_enable: false,
        single_ai_ready_for_enable: true,
        models: {
          single: {
            api_key_set: true,
            last_test_ok: true,
          },
        },
      },
    } as Awaited<ReturnType<typeof api.getThreeModelStatus>>);
    vi.spyOn(api, 'getSystemStatePublic').mockResolvedValue({
      data: {
        prediction_mode: 'single_ai',
      },
    } as Awaited<ReturnType<typeof api.getSystemStatePublic>>);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <App>
          <MemoryRouter initialEntries={['/mode']}>
            <ModeSelectPage />
          </MemoryRouter>
        </App>
      );
    });

    const html = container.innerHTML;
    expect(html).toContain('当前');
    expect(html).toContain('当前模式');
    expect(html).toContain('当前正在使用这个模式');
    expect(html).not.toContain('启用 单 AI 模式');
    expect(html).toContain('启用 三模型协作模式');
    expect(html).toContain('启用 规则参考模式');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
