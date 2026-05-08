// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import MistakeBookPage from './MistakeBookPage';

const useMistakesQueryMock = vi.fn();

vi.mock('../hooks', () => ({
  useMistakesQuery: (...args: unknown[]) => useMistakesQueryMock(...args),
}));

describe('MistakeBookPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('uses server total instead of local row count for the summary and pagination', async () => {
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
    Object.defineProperty(globalThis, 'ResizeObserver', {
      writable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
    Object.defineProperty(window, 'getComputedStyle', {
      writable: true,
      value: () => ({
        getPropertyValue: () => '',
      }),
    });
    useMistakesQueryMock.mockReturnValue({
      data: {
        mistakes: [
          {
            id: 1,
            boot_number: 3,
            game_number: 12,
            error_id: 'ERR-1',
            error_type: '趋势误判',
            predict_direction: '庄',
            actual_result: '闲',
            confidence: 0.88,
            analysis: '判断过早',
            correction: '多看两手',
          },
        ],
        total: 42,
      },
    });

    const queryClient = new QueryClient();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/dashboard/mistakes']}>
            <MistakeBookPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    expect(useMistakesQueryMock).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
    });
    expect(container.innerHTML).toContain('共 42 条记录');
    expect(container.innerHTML).toContain('共 42 条');

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  });
});
