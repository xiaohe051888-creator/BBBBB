// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import BetRecordsPage from './BetRecordsPage';
import MistakeBookPage from './MistakeBookPage';

const useBetsQueryMock = vi.fn();
const useMistakesQueryMock = vi.fn();

vi.mock('../hooks', () => ({
  useBetsQuery: (...args: unknown[]) => useBetsQueryMock(...args),
  useMistakesQuery: (...args: unknown[]) => useMistakesQueryMock(...args),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

describe('mobile page containers', () => {
  beforeEach(() => {
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
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  const renderPage = async (page: React.ReactNode) => {
    const queryClient = new QueryClient();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/dashboard']}>
            {page}
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    return { container, root, queryClient };
  };

  it('keeps the bets page on the shared wrapper spacing instead of overriding it inline', async () => {
    useBetsQueryMock.mockReturnValue({
      data: { bets: [], total: 0 },
    });

    const { container, root, queryClient } = await renderPage(<BetRecordsPage />);
    const page = container.querySelector('.bet-records-page');
    const navBar = container.querySelector('.bet-records-page .page-nav-bar');

    expect(page?.getAttribute('style') ?? '').not.toContain('padding');
    expect(navBar?.getAttribute('style')).toBeNull();

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  });

  it('keeps the mistakes page on the shared wrapper spacing instead of overriding it inline', async () => {
    useMistakesQueryMock.mockReturnValue({
      data: { mistakes: [], total: 0 },
    });

    const { container, root, queryClient } = await renderPage(<MistakeBookPage />);
    const page = container.querySelector('.mistakes-page');
    const navBar = container.querySelector('.mistakes-page .page-nav-bar');

    expect(page?.getAttribute('style') ?? '').not.toContain('padding');
    expect(page?.getAttribute('style') ?? '').not.toContain('max-width');
    expect(navBar?.getAttribute('style')).toBeNull();

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  });
});
