// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { Grid } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

import DashboardHeader from './DashboardHeader';

const diagnostics = {
  currentMode: 'single_ai',
  wsStatus: 'connected',
  wsLatency: 18,
  wsReconnectCount: 0,
  backendStatus: 'online',
  backendLatency: 21,
  aiModels: [],
  aiAllOk: true,
  activeIssues: [],
  criticalIssueCount: 0,
  overallHealth: 'healthy',
  backgroundTasks: {
    runningCount: 0,
    runningTypes: [],
    latestErrors: [],
  },
} as const;

describe('DashboardHeader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders dedicated mobile top and status rows for compact adaptive layout', () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(Grid, 'useBreakpoint').mockReturnValue({ md: false } as ReturnType<typeof Grid.useBreakpoint>);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter>
          <DashboardHeader
            systemState={{
              boot_number: 6,
              game_number: 28,
              next_game_number: 29,
              current_game_result: '庄',
              predict_direction: '闲',
              balance: 12888,
            }}
            bettingAdvice={{} as never}
            diagnostics={diagnostics as never}
            onDismissIssue={() => {}}
            onRetryConnection={() => {}}
            isLoggedIn={false}
            onOpenLogin={() => {}}
            gameCount={28}
          />
        </MemoryRouter>
      );
    });

    const html = container.innerHTML;

    expect(html).toContain('dashboard-header-mobile-top-row');
    expect(html).toContain('dashboard-header-mobile-status-row');
    expect(html).toContain('dashboard-action-group');
    expect(html).toContain('dashboard-balance-badge');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
