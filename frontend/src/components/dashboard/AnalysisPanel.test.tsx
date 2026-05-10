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

  it('shows a compact outcome card for single ai analysis', async () => {
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
            combined_summary: '综合建议继续观察庄方向',
            prediction_mode: 'single_ai',
            analysis_outcome: {
              direction: '庄',
              confidence: 0.83,
              confidence_label: '高',
              source: 'single_ai',
              short_reason: '当前走势仍偏庄，本局建议继续跟庄。',
              final_reason: '大路和珠盘路都继续支持庄，所以本局先跟庄。',
              road_explanations: {},
            },
          }}
        />
      );
    });

    const html = container.innerHTML;

    expect(html).toContain('本局建议');
    expect(html).toContain('单AI判断');
    expect(html).toContain('高把握');
    expect(html).toContain('当前走势仍偏庄，本局建议继续跟庄。');
    expect(html).not.toContain('庄方向判断');
    expect(html).not.toContain('综合判断');
    expect(html).not.toContain('推理详情');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps the completed outcome card visible after auto bet is placed', async () => {
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
            analysis_outcome: {
              direction: '庄',
              confidence: 0.76,
              confidence_label: '高',
              source: 'single_ai',
              short_reason: '系统已完成判断，本局继续跟庄。',
              final_reason: '当前主走势没有看到明显反转，仍以庄为主。',
              road_explanations: {},
            },
          }}
        />
      );
    });

    const html = container.innerHTML;

    expect(html).toContain('系统已完成判断，本局继续跟庄。');
    expect(html).toContain('本局建议');
    expect(html).toContain('76%');
    expect(html).not.toContain('系统正在分析下一局，请稍候...');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('shows a compact outcome card for rule fallback', async () => {
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
            confidence: 0.61,
            combined_summary: '上游接口调用失败，已切换规则兜底。',
            prediction_mode: 'single_ai',
            analysis_outcome: {
              direction: '庄',
              confidence: 0.61,
              confidence_label: '中',
              source: 'rule_fallback',
              short_reason: '本局AI没有及时给出稳定结果，系统已改用规则判断继续下注。',
              final_reason: '五条路里三条继续支持庄，所以最终偏向庄。',
              road_explanations: {},
            },
          }}
        />
      );
    });

    const html = container.innerHTML;

    expect(html).toContain('本局建议');
    expect(html).toContain('规则兜底');
    expect(html).not.toContain('上游接口调用失败');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('shows waiting reveal copy instead of preparing analysis when a bet is already pending', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AnalysisPanel
          hasGameData
          hasPendingBet
          aiAnalyzing={false}
          workflowStage={{
            type: 'waiting_reveal',
            showAnalysisLoading: false,
            showCompletedAnalysis: false,
          }}
          analysis={null}
        />
      );
    });

    const html = container.innerHTML;

    expect(html).toContain('本局已下注');
    expect(html).toContain('等待开奖结果');
    expect(html).not.toContain('正在准备AI分析...');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
