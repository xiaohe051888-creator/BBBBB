// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from './DashboardPage';

const hooksMock = vi.hoisted(() => ({
  useSmartDetection: vi.fn(() => ({
    integrityIssues: [],
    abnormalPatterns: [],
    bettingAdvice: [],
    alerts: [],
    removeAlert: vi.fn(),
    markSynced: vi.fn(),
  })),
  useSystemDiagnostics: vi.fn(() => ({
    diagnostics: [],
    dismissIssue: vi.fn(),
    retryConnection: vi.fn(),
    addIssue: vi.fn(),
  })),
  useSystemStateQuery: vi.fn(() => ({ data: { status: '等待开奖', next_game_number: 12, boot_number: 3, balance: 5000 } })),
  useStatsQuery: vi.fn(() => ({ data: { hit_count: 1, miss_count: 0, accuracy: 1 } })),
  useLogsQuery: vi.fn(() => ({ data: { logs: [] } })),
  useGamesQuery: vi.fn(() => ({ data: { games: [], total: 0 } })),
  useBetsQuery: vi.fn(() => ({ data: { bets: [], total: 0 } })),
  useRoadsQuery: vi.fn(() => ({ data: { roads: null } })),
  useAnalysisQuery: vi.fn(() => ({ data: null, isFetching: false })),
  useRevealResultMutation: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useRetrySingleAiAnalysisMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useAddLogOptimistically: vi.fn(() => vi.fn()),
  useAddBetOptimistically: vi.fn(() => vi.fn()),
  useAddGameOptimistically: vi.fn(() => vi.fn()),
  useUpdateAnalysisOptimistically: vi.fn(() => vi.fn()),
  useUpdateStateOptimistically: vi.fn(() => vi.fn()),
  useWebSocket: vi.fn(),
}));

vi.mock('../hooks', () => hooksMock);
vi.mock('../components/dashboard', async () => {
  const actual = await vi.importActual<typeof import('../components/dashboard')>('../components/dashboard');
  return {
    ...actual,
    DashboardHeader: () => <div>header</div>,
    WorkflowStatusBar: () => <div>workflow</div>,
    AnalysisPanel: () => <div>analysis</div>,
    RevealModal: () => null,
  };
});
vi.mock('../components/tables', () => ({
  GameTable: () => <div>games</div>,
  BetTable: () => <div>bets</div>,
  LogTable: () => <div>logs</div>,
}));
vi.mock('../components/roads', () => ({ FiveRoadChart: () => <div>roads</div> }));
vi.mock('../components/learning', () => ({ LearningStatusPanel: () => <div>learning</div> }));
vi.mock('../components/ui', () => ({ SmartAlerts: () => <div>alerts</div> }));
vi.mock('../components/dashboard/AdminAlertsBar', () => ({ AdminAlertsBar: () => <div>admin alerts</div> }));
vi.mock('../components/dashboard/InstallAppEntry', () => ({ InstallAppEntry: () => <div>install-entry</div> }));

describe('DashboardPage install entry', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders the install entry near the top dashboard helpers', async () => {
    const queryClient = new QueryClient();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/dashboard']}>
            <DashboardPage />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });

    expect(container.innerHTML).toContain('workflow');
    expect(container.innerHTML).toContain('install-entry');
    expect(container.innerHTML).toContain('admin alerts');

    await act(async () => root.unmount());
    container.remove();
  });
});
