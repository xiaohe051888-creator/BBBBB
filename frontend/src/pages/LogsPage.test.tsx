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
const getLogsMock = vi.fn();

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
  getLogs: (...args: unknown[]) => getLogsMock(...args),
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

  it('shows a simplified detail modal without the duplicate copy textarea block', async () => {
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
      data: {
        logs: [
          {
            id: 1,
            log_time: '2026-05-10T04:38:55Z',
            game_number: 23,
            event_code: 'LOG-MDL-003',
            event_type: '规则兜底接管',
            event_result: '成功',
            description: '单AI失败后已切换规则兜底继续下注：上传触发分析时发生系统错误: analysis timeout after 45.00s',
            category: '工作流事件',
            priority: 'P1',
            task_id: 'task-23',
            is_pinned: false,
          },
        ],
        total: 1,
      },
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
            <MemoryRouter initialEntries={['/dashboard/logs']}>
              <LogsPage />
            </MemoryRouter>
          </QueryClientProvider>
        </App>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    const detailButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '详情',
    );
    expect(detailButton).toBeTruthy();

    await act(async () => {
      detailButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const modalContent = document.querySelector('.ant-modal');
    expect(modalContent).toBeTruthy();
    const modalText = modalContent?.textContent || '';
    const modalHtml = modalContent?.innerHTML || '';
    expect(modalText).toContain('记录详情');
    expect(modalText).toContain('复制摘要');
    expect(modalText).toContain('系统记录');
    expect(modalText).toContain('变动');
    expect(modalText).toContain('影响');
    expect(modalText).toContain('状态');
    expect(modalText).not.toContain('analysis timeout after 45.00s');
    expect(modalText).not.toContain('LOG-MDL-003');
    expect(modalText).not.toContain('单AI');
    expect(modalText).not.toContain('规则兜底');
    expect(modalText).not.toContain('复制原始记录');
    expect(modalText).not.toContain('一键复制下面这段通俗说明');
    expect(modalText).not.toContain('全选');
    expect(modalText).not.toContain('你可能会关心的信息');
    expect(modalText).not.toContain('事件编码');
    expect(modalText).not.toContain('处理编号');
    expect(modalText).not.toContain('复制通俗说明');
    expect(modalText).not.toContain('系统原始记录（高级信息）');
    expect(modalText).not.toContain('这次发生了什么');
    expect(modalText).not.toContain('对当前使用有什么影响');
    expect(modalText).not.toContain('建议你接下来怎么做');
    expect(modalHtml).toContain('log-detail-hero');
    expect(modalHtml).toContain('log-detail-block');
    expect(modalHtml).not.toContain('<pre');

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  });

  it('exports user-readable chinese json instead of raw technical log fields', async () => {
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
    const exportLog = {
      id: 1,
      log_time: '2026-05-10T04:38:55Z',
      game_number: 23,
      event_code: 'LOG-MDL-003',
      event_type: '规则兜底接管',
      event_result: '成功',
      description: '单AI失败后已切换规则兜底继续下注：上传触发分析时发生系统错误: analysis timeout after 45.00s',
      category: '工作流事件',
      priority: 'P1',
      task_id: 'task-23',
      is_pinned: false,
    };
    useLogsQueryMock.mockReturnValue({
      data: { logs: [exportLog], total: 1 },
      refetch: vi.fn(),
      isFetching: false,
      error: null,
    });
    getLogsMock.mockResolvedValue({
      data: {
        data: [exportLog],
      },
    });

    const originalBlob = globalThis.Blob;
    const originalCreateElement = document.createElement.bind(document);
    class MockBlob {
      private readonly content: string;

      constructor(parts: Array<string | ArrayBuffer | ArrayBufferView>) {
        this.content = parts
          .map((part) => (typeof part === 'string' ? part : String(part)))
          .join('');
      }

      async text() {
        return this.content;
      }
    }
    Object.defineProperty(globalThis, 'Blob', {
      writable: true,
      value: MockBlob,
    });

    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        Object.defineProperty(element, 'click', {
          writable: true,
          value: vi.fn(),
        });
      }
      return element;
    }) as typeof document.createElement);

    let exportedBlob: { text: () => Promise<string> } | null = null;
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn((blob: unknown) => {
        exportedBlob = blob as { text: () => Promise<string> };
        return 'blob:mock-export';
      }),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });

    const queryClient = new QueryClient();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <App>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/dashboard/logs']}>
              <LogsPage />
            </MemoryRouter>
          </QueryClientProvider>
        </App>,
      );
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });

    const exportButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('导出数据'),
    );
    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(getLogsMock).toHaveBeenCalled();
    expect(exportedBlob).toBeTruthy();
    const text = (await exportedBlob!.text()).replace(/^\uFEFF/, '');
    expect(text).toContain('标题');
    expect(text).toContain('变动');
    expect(text).toContain('影响');
    expect(text).toContain('状态');
    expect(text).toContain('系统记录');
    expect(text).toContain('智能分析：系统已自动改用备用判断');
    expect(text).not.toContain('LOG-MDL-003');
    expect(text).not.toContain('analysis timeout after 45.00s');
    expect(text).not.toContain('rule_fallback');
    expect(text).not.toContain('这次发生了什么');
    expect(text).not.toContain('对当前使用有什么影响');
    expect(text).not.toContain('建议你接下来怎么做');

    await act(async () => {
      root.unmount();
    });
    Object.defineProperty(globalThis, 'Blob', {
      writable: true,
      value: originalBlob,
    });
    queryClient.clear();
    container.remove();
  });
});
