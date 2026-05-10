// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AnalysisPanel from './AnalysisPanel';

vi.mock('../../hooks/useQueries', () => ({
  useSystemStateQuery: () => ({
    data: {
      prediction_mode: 'ai',
    },
  }),
}));

describe('AnalysisPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('shows beginner-friendly role labels in ai mode', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AnalysisPanel
          hasGameData
          hasPendingBet={false}
          aiAnalyzing={false}
          workflowStage={{
            type: 'analyzed_pending_bet',
            showAnalysisLoading: false,
            showCompletedAnalysis: true,
          }}
          analysis={{
            prediction: '庄',
            confidence: 0.83,
            banker_summary: '庄方向偏强',
            player_summary: '闲方向偏弱',
            combined_summary: '综合建议继续观察庄方向',
            prediction_mode: 'ai',
          }}
        />
      );
    });

    const html = container.innerHTML;

    expect(html).toContain('庄方向判断');
    expect(html).toContain('闲方向判断');
    expect(html).toContain('综合判断');
    expect(html).toContain('独立判断');
    expect(html).toContain('汇总判断');
    expect(html).not.toContain('庄模型');
    expect(html).not.toContain('闲模型');
    expect(html).not.toContain('综合模型');
    expect(html).not.toContain('模型接口');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps the completed analysis visible after auto bet is placed', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AnalysisPanel
          hasGameData
          hasPendingBet
          aiAnalyzing
          workflowStage={{
            type: 'waiting_reveal',
            showAnalysisLoading: false,
            showCompletedAnalysis: true,
          }}
          analysis={{
            prediction: '庄',
            confidence: 0.76,
            combined_summary: '综合建议本局继续跟庄',
            prediction_mode: 'single_ai',
          }}
        />
      );
    });

    const html = container.innerHTML;

    expect(html).toContain('综合建议本局继续跟庄');
    expect(html).toContain('76%');
    expect(html).not.toContain('系统正在分析下一局，请稍候...');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
