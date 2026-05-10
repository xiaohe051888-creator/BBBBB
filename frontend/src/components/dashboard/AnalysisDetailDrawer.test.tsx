// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AnalysisOutcome } from '../../types/models';
import AnalysisDetailDrawer from './AnalysisDetailDrawer';

const SAMPLE_OUTCOME: AnalysisOutcome = {
  direction: '庄',
  confidence: 0.72,
  confidence_label: '中',
  source: 'rule_fallback',
  short_reason: '当前主走势还偏庄。',
  final_reason: '三条路支持庄，两条路中性，所以最终偏庄。',
  fallback_reason: '单AI没有及时返回，系统改用规则兜底。',
  road_explanations: {
    big_road: {
      trend_label: '大路连庄',
      tendency: '庄',
      support_level: '强',
      plain_summary: '大路连续走庄，主走势还在延续。',
    },
    bead_road: {
      trend_label: '珠盘路偏庄',
      tendency: '庄',
      support_level: '中',
      plain_summary: '珠盘路近期庄更多。',
    },
    big_eye_road: {
      trend_label: '大眼仔偏顺',
      tendency: '庄',
      support_level: '中',
      plain_summary: '大眼仔保持顺势。',
    },
    small_road: {
      trend_label: '小路中性',
      tendency: '中性',
      support_level: '弱',
      plain_summary: '小路没有明显新方向。',
    },
    cockroach_road: {
      trend_label: '螳螂路轻微偏庄',
      tendency: '庄',
      support_level: '弱',
      plain_summary: '螳螂路暂未出现明确反转。',
    },
  },
  technical_diagnostic: {
    message: '单AI没有及时返回稳定结果，已自动切换规则兜底。',
  },
};

const REQUIRED_NEW_COPY = [
  '智能分析详情',
  '决断来源',
  '决策机制',
  '决断强度',
  '备用判断',
  '补充说明',
  '收起',
] as const;

const REJECTED_LEGACY_COPY = [
  '规则兜底',
  '判断来源',
  '把握程度',
  '技术说明',
  '推理详情',
  '看完了，回到主面板',
  '如果这一页已经看完了，可以直接从这里收起详情，回到主面板继续看本局状态。',
] as const;

const installComputedStyleFallback = () => {
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = ((element: Element) => {
    const style = originalGetComputedStyle(element);
    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return (name: string) => target.getPropertyValue(name) || '0px';
        }

        return Reflect.get(target, prop);
      },
    });
  }) as typeof window.getComputedStyle;

  return () => {
    window.getComputedStyle = originalGetComputedStyle;
  };
};

const renderDrawer = async (onClose = () => {}) => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const restoreComputedStyle = installComputedStyleFallback();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<AnalysisDetailDrawer open onClose={onClose} outcome={SAMPLE_OUTCOME} />);
  });

  let unmounted = false;
  const cleanup = async () => {
    if (!unmounted) {
      await act(async () => {
        root.unmount();
      });
      unmounted = true;
    }
    container.remove();
    restoreComputedStyle();
  };

  return { cleanup, root };
};

describe('AnalysisDetailDrawer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('locks the new detail copy and rejects legacy wording', async () => {
    const { cleanup } = await renderDrawer();
    const html = document.body.innerHTML;

    REQUIRED_NEW_COPY.forEach((text) => {
      expect(html).toContain(text);
    });

    REJECTED_LEGACY_COPY.forEach((text) => {
      expect(html).not.toContain(text);
    });

    expect(html).toContain('72%');
    expect(html).toContain('本局决断：庄');
    expect(html).toContain('大路');

    await cleanup();
  });

  it('renders the new primary close action and calls onClose when clicked', async () => {
    const handleClose = vi.fn();
    const { cleanup } = await renderDrawer(handleClose);

    const normalize = (text?: string | null) => text?.replace(/\s+/g, '') || '';
    const collapseButton = Array.from(document.querySelectorAll('button')).find((button) =>
      normalize(button.textContent).includes('收起'),
    );
    const primaryButton = Array.from(document.querySelectorAll('button')).find((button) =>
      normalize(button.textContent).includes('返回'),
    );
    expect(collapseButton).toBeTruthy();
    expect(primaryButton).toBeTruthy();
    expect(document.body.innerHTML).not.toContain('我知道了，收起详情');

    await act(async () => {
      collapseButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(handleClose).toHaveBeenCalledTimes(1);

    await cleanup();
  });

  it('still allows the drawer to unmount cleanly after rendering', async () => {
    const { cleanup } = await renderDrawer();
    await cleanup();
  });

  it('translates fallback diagnostics in visible decision copy instead of showing raw english fragments', async () => {
    const noisyOutcome: AnalysisOutcome = {
      ...SAMPLE_OUTCOME,
      short_reason: '单AI失败后已切换规则兜底继续下注：下一局AI分析失败(reveal): analysis returned no result',
      final_reason: '单AI失败后已切换规则兜底继续下注：下一局AI分析失败(reveal): analysis returned no result',
    };
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const restoreComputedStyle = installComputedStyleFallback();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<AnalysisDetailDrawer open onClose={() => {}} outcome={noisyOutcome} />);
    });

    const html = document.body.innerHTML;
    expect(html).toContain('智能判断这次没有及时给出稳定结果');
    expect(html).toContain('备用判断');
    expect(html).not.toContain('analysis returned no result');
    expect(html).not.toContain('(reveal)');
    expect(html).not.toContain('下一局AI分析失败');

    await act(async () => {
      root.unmount();
    });
    container.remove();
    restoreComputedStyle();
  });
});
