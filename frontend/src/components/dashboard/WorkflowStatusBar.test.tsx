// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import WorkflowStatusBar from './WorkflowStatusBar';

vi.mock('../../hooks/useWaitTimer', () => ({
  useWaitTimer: () => ({
    seconds: 11,
    formattedTime: '00:11',
  }),
}));

describe('WorkflowStatusBar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('shows waiting reveal copy when the workflow stage is waiting_reveal', () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <WorkflowStatusBar
          hasPendingBet
          hasGameData
          analysis={{
            prediction: '庄',
            confidence: 0.78,
          }}
          systemState={{
            status: '等待开奖',
            game_number: 17,
            next_game_number: 18,
            pending_bet: {
              game_number: 18,
            },
          }}
          workflowStage={{
            type: 'waiting_reveal',
            showAnalysisLoading: false,
            showCompletedAnalysis: true,
          }}
          onOpenReveal={() => {}}
        />
      );
    });

    const html = container.innerHTML;

    expect(html).toContain('第 18 局已下注，等待开奖结果');
    expect(html).toContain('开奖');
    expect(html).not.toContain('系统自动下注中...');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
