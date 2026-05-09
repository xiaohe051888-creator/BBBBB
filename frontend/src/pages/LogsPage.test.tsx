// @vitest-environment jsdom
import React from 'react';
import { App } from 'antd';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import LogsPage from './LogsPage';

const useLogsQueryMock = vi.fn();

vi.mock('../hooks', () => ({
  useLogsQuery: (...args: unknown[]) => useLogsQueryMock(...args),
  useAddLogsOptimistically: () => vi.fn(),
  useWebSocket: () => undefined,
}));

vi.mock('../hooks/useSystemDiagnostics', () => ({
  useSystemDiagnostics: () => ({
    diagnostics: {},
    dismissIssue: vi.fn(),
    retryConnection: vi.fn(),
  }),
}));

vi.mock('../components/ui/SystemStatusPanel', () => ({
  SystemStatusPanel: () => <div>SystemStatusPanel</div>,
}));

vi.mock('../services/api', () => ({
  getToken: () => 'token',
  getLogs: vi.fn(),
}));

describe('LogsPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('hydrates log filters from the url before requesting data', async () => {
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
    Object.defineProperty(globalThis, 'ResizeObserver', {
      writable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
    useLogsQueryMock.mockReturnValue({
      data: { logs: [], total: 2 },
      refetch: vi.fn(),
      isFetching: false,
      error: null,
    });

    const queryClient = new QueryClient();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <App>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/dashboard/logs?priority=P1&task_id=task-7&q=LOG-MDL-002']}>
              <LogsPage />
            </MemoryRouter>
          </QueryClientProvider>
        </App>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    expect(useLogsQueryMock).toHaveBeenCalled();
    expect(useLogsQueryMock.mock.calls.at(-1)?.[0]).toMatchObject({
      priority: 'P1',
      taskId: 'task-7',
      q: 'LOG-MDL-002',
      page: 1,
      pageSize: 50,
    });
    expect(container.innerHTML).toContain('共 2 条记录');

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  });
});
