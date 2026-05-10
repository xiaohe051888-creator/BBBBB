// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AnalysisPanel from './AnalysisPanel';
import {
  formatAnalysisOutcomeLabel,
  formatAnalysisSourceLabel,
  formatConfidenceLabel,
} from '../../utils/beginnerCopy';

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

    expect(html).toContain(formatAnalysisOutcomeLabel('decision'));
    expect(html).toContain('本局决断');
    expect(html).toContain(formatAnalysisOutcomeLabel('method'));
    expect(html).toContain(formatAnalysisSourceLabel('single_ai'));
    expect(html).toContain(formatAnalysisOutcomeLabel('confidence'));
    expect(html).toContain(formatConfidenceLabel());
    expect(html).toContain(formatAnalysisOutcomeLabel('detailAction'));
    expect(html).toContain('当前走势仍偏庄，本局建议继续跟庄。');
    expect(html).not.toContain('单AI判断');
    expect(html).not.toContain('AI');
    expect(html).not.toContain('模型');
    expect(html).not.toContain('规则兜底');
    expect(html).not.toContain('规则辅助');
    expect(html).not.toContain('高把握');
    expect(html).not.toContain('查看详细原因');

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
    expect(html).toContain('本局决断');
    expect(html).toContain('76%');
    expect(html).toContain('已完成研判');
    expect(html).toContain(formatAnalysisOutcomeLabel('detailAction'));
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
            combined_summary: '当前走势暂不稳定，系统已切换备用判断。',
            prediction_mode: 'single_ai',
            analysis_outcome: {
              direction: '庄',
              confidence: 0.61,
              confidence_label: '中',
              source: 'rule_fallback',
              short_reason: '当前走势暂不稳定，系统已改用备用判断继续给出建议。',
              final_reason: '五条路里三条继续支持庄，所以这次结果仍偏向庄。',
              fallback_reason: '本局暂未形成稳定判断，系统已切换备用判断，当前流程继续进行。',
              road_explanations: {},
            },
          }}
        />
      );
    });

    const html = container.innerHTML;

    expect(html).toContain(formatAnalysisOutcomeLabel('method'));
    expect(html).toContain(formatAnalysisSourceLabel('rule_fallback'));
    expect(html).toContain(formatAnalysisOutcomeLabel('confidence'));
    expect(html).toContain(formatAnalysisOutcomeLabel('detailAction'));
    expect(html).not.toContain('上游接口调用失败');
    expect(html).not.toContain('规则兜底');
    expect(html).not.toContain('AI');
    expect(html).not.toContain('规则辅助');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('translates raw fallback diagnostics in the summary card instead of showing english fragments', async () => {
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
            confidence: 0.6,
            combined_summary: '单AI失败后已切换规则兜底继续下注：下一局AI分析失败(reveal): analysis returned no result',
            prediction_mode: 'single_ai',
            analysis_outcome: {
              direction: '庄',
              confidence: 0.6,
              confidence_label: '中',
              source: 'rule_fallback',
              short_reason: '单AI失败后已切换规则兜底继续下注：下一局AI分析失败(reveal): analysis returned no result',
              final_reason: '单AI失败后已切换规则兜底继续下注：下一局AI分析失败(reveal): analysis returned no result',
              fallback_reason: '本局暂未形成稳定判断，系统已切换备用判断，当前流程继续进行。',
              road_explanations: {},
            },
          }}
        />
      );
    });

    const html = container.innerHTML;

    expect(html).toContain('智能判断这次没有及时给出稳定结果');
    expect(html).toContain('备用判断');
    expect(html).not.toContain('analysis returned no result');
    expect(html).not.toContain('(reveal)');
    expect(html).not.toContain('下一局AI分析失败');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('shows future-tech loading copy while analysis is running', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AnalysisPanel
          hasGameData
          hasPendingBet={false}
          aiAnalyzing
          workflowStage={{
            type: 'analyzing',
            showAnalysisLoading: true,
            showCompletedAnalysis: false,
          }}
          analysis={null}
        />
      );
    });

    const html = container.innerHTML;

    expect(html).toContain('系统正在综合比对走势');
    expect(html).toContain('请稍候，判断结果马上出来');
    expect(html).not.toContain('系统正在分析下一局，请稍候...');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('shows future-tech empty copy before the first result is entered', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AnalysisPanel
          hasGameData={false}
          hasPendingBet={false}
          aiAnalyzing={false}
          workflowStage={{
            type: 'idle',
            showAnalysisLoading: false,
            showCompletedAnalysis: false,
          }}
          analysis={null}
        />
      );
    });

    const html = container.innerHTML;

    expect(html).toContain('系统已准备好');
    expect(html).toContain('请先录入本靴结果，系统会自动开始判断');
    expect(html).not.toContain('系统已就绪');
    expect(html).not.toContain('请点击【🎯 开奖】按钮录入第一局结果开始AI分析');

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

    expect(html).toContain('本局已完成下注');
    expect(html).toContain('等待录入开奖结果');
    expect(html).not.toContain('正在准备AI分析...');
    expect(html).not.toContain('本局已下注');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('does not render a completed recommendation card for invalid analysis content', async () => {
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
            prediction: null,
            confidence: 0,
            combined_summary: '解析失败',
            prediction_mode: 'single_ai',
            analysis_outcome: null,
          }}
        />
      );
    });

    const html = container.innerHTML;

    expect(html).not.toContain('已完成判断');
    expect(html).not.toContain('本局建议');
    expect(html).not.toContain('解析失败');
    expect(html).toContain('系统正在整理本局数据');
    expect(html).toContain('准备开始本局判断');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
