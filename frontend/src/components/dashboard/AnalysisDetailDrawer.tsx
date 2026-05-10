import React from 'react';
import { Collapse, Drawer, Tag } from 'antd';

import type { AnalysisOutcome } from '../../types/models';

interface AnalysisDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  outcome: AnalysisOutcome;
}

type RoadKey =
  | 'big_road'
  | 'bead_road'
  | 'big_eye_road'
  | 'small_road'
  | 'cockroach_road';

const ROAD_KEYS: RoadKey[] = ['big_road', 'bead_road', 'big_eye_road', 'small_road', 'cockroach_road'];

const ROAD_LABELS: Record<RoadKey, string> = {
  big_road: '大路',
  bead_road: '珠盘路',
  big_eye_road: '大眼仔路',
  small_road: '小路',
  cockroach_road: '螳螂路',
};

const getSourceLabel = (source: AnalysisOutcome['source']) => {
  return source === 'rule_fallback' ? '规则兜底' : '单AI判断';
};

const getSourceExplanation = (outcome: AnalysisOutcome) => {
  if (outcome.source === 'rule_fallback') {
    return outcome.fallback_reason?.trim() || '本局单AI没有返回稳定结果，系统改用规则判断完成本局下注。';
  }

  return '本局由单AI直接完成判断，系统按单AI结果下注。';
};

export const AnalysisDetailDrawer: React.FC<AnalysisDetailDrawerProps> = ({ open, onClose, outcome }) => {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="推理详情"
      placement="bottom"
      size="large"
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <section>
          <h3 style={{ margin: 0, fontSize: 16 }}>本局结论</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <Tag color={outcome.source === 'rule_fallback' ? 'orange' : 'green'}>{getSourceLabel(outcome.source)}</Tag>
            <Tag color="blue">{outcome.confidence_label}把握</Tag>
            <Tag>{Math.round(outcome.confidence * 100)}%</Tag>
          </div>
          <p style={{ margin: '12px 0 6px', fontWeight: 600 }}>本局建议：{outcome.direction}</p>
          <p style={{ margin: 0, color: 'rgba(0,0,0,0.72)', lineHeight: 1.7 }}>{outcome.short_reason}</p>
        </section>

        <section>
          <h3 style={{ margin: 0, fontSize: 16 }}>五条路怎么看</h3>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {ROAD_KEYS.map((key) => {
              const explanation = outcome.road_explanations[key];

              return (
                <article
                  key={key}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid rgba(5,5,5,0.06)',
                    background: '#fafafa',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <h4 style={{ margin: 0, fontSize: 15 }}>{ROAD_LABELS[key]}</h4>
                    {explanation ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Tag>{explanation.tendency}</Tag>
                        <Tag color="processing">{explanation.support_level}支持</Tag>
                      </div>
                    ) : null}
                  </div>
                  <p style={{ margin: '8px 0 4px', fontWeight: 500, color: '#262626' }}>
                    {explanation?.trend_label || '当前暂无这条路的额外解释。'}
                  </p>
                  <p style={{ margin: 0, lineHeight: 1.7, color: 'rgba(0,0,0,0.72)' }}>
                    {explanation?.plain_summary || '系统暂时没有拿到这条路的详细说明。'}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section>
          <h3 style={{ margin: 0, fontSize: 16 }}>最终为什么押这个方向</h3>
          <p style={{ margin: '12px 0 0', lineHeight: 1.7, color: 'rgba(0,0,0,0.72)' }}>{outcome.final_reason}</p>
        </section>

        <section>
          <h3 style={{ margin: 0, fontSize: 16 }}>来源说明</h3>
          <p style={{ margin: '12px 0 0', lineHeight: 1.7, color: 'rgba(0,0,0,0.72)' }}>
            {getSourceExplanation(outcome)}
          </p>
        </section>

        {outcome.technical_diagnostic?.message ? (
          <Collapse
            items={[
              {
                key: 'diagnostic',
                label: '技术说明',
                children: (
                  <p style={{ margin: 0, lineHeight: 1.7 }}>
                    {outcome.technical_diagnostic.message}
                  </p>
                ),
              },
            ]}
          />
        ) : null}
      </div>
    </Drawer>
  );
};

export default AnalysisDetailDrawer;
