// @vitest-environment jsdom
import React from 'react';
import { App } from 'antd';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { ApiConfigModal } from './ApiConfigModal';

describe('ApiConfigModal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the beginner-friendly secret key label', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    Object.defineProperty(window, 'getComputedStyle', {
      writable: true,
      value: () => ({
        getPropertyValue: () => '',
      }),
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <App>
          <ApiConfigModal
            visible
            onCancel={() => {}}
            onSuccess={() => {}}
            role="banker"
            currentStatus={{
              models: {
                banker: {
                  provider: 'openai',
                  model: 'gpt-4o',
                  api_key_set: true,
                  base_url: 'https://api.openai.com/v1',
                },
              },
            } as never}
          />
        </App>
      );
    });

    expect(document.body.innerHTML).toContain('访问密钥');
    expect(document.body.innerHTML).not.toContain('接口密钥');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('locks single-ai config to DeepSeek V4 Pro and the official api url', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
    Object.defineProperty(window, 'getComputedStyle', {
      writable: true,
      value: () => ({
        getPropertyValue: () => '',
      }),
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <App>
          <ApiConfigModal
            visible
            onCancel={() => {}}
            onSuccess={() => {}}
            role="single"
            currentStatus={{
              models: {
                single: {
                  provider: 'deepseek',
                  model: 'deepseek-v4-pro',
                  api_key_set: true,
                  base_url: 'https://api.deepseek.com',
                },
              },
            } as never}
          />
        </App>
      );
    });

    const html = document.body.innerHTML;
    expect(html).toContain('当前单AI模式固定使用深度求索 V4 专业版');
    expect(html).toContain('https://api.deepseek.com');
    expect(html).toContain('深度求索 V4 专业版');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
