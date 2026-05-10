// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AnalysisDetailDrawer from './AnalysisDetailDrawer';

describe('AnalysisDetailDrawer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows five road explanations and final reason', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AnalysisDetailDrawer
          open
          onClose={() => {}}
          outcome={{
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
          }}
        />
      );
    });

    const html = document.body.innerHTML;

    expect(html).toContain('五条路怎么看');
    expect(html).toContain('大路');
    expect(html).toContain('最终为什么押这个方向');
    expect(html.indexOf('本局结论')).toBeGreaterThan(-1);
    expect(html.indexOf('最终为什么押这个方向')).toBeGreaterThan(html.indexOf('本局结论'));
    expect(html.indexOf('五条路怎么看')).toBeGreaterThan(html.indexOf('最终为什么押这个方向'));
    expect(html.indexOf('来源说明')).toBeGreaterThan(html.indexOf('五条路怎么看'));
    expect(html).toContain('规则兜底');
    expect(html).toContain('72%');
    expect(html).toContain('本局建议：庄');
    expect(html).toContain('把握度');
    expect(html).toContain('判断来源');
    expect(html).toContain('技术说明');

    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.getComputedStyle = originalGetComputedStyle;
  });

  it('renders an explicit close action and calls onClose when clicked', async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const handleClose = vi.fn();

    await act(async () => {
      root.render(
        <AnalysisDetailDrawer
          open
          onClose={handleClose}
          outcome={{
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
          }}
        />
      );
    });

    const closeButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('收起详情'));
    expect(closeButton).toBeTruthy();

    await act(async () => {
      closeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(handleClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.getComputedStyle = originalGetComputedStyle;
  });
});
