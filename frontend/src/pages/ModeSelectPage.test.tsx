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
});
