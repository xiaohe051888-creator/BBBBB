import React from 'react';
import { Button, Collapse, Drawer, Tag } from 'antd';

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

const shellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  maxWidth: 860,
  margin: '0 auto',
  paddingBottom: 24,
};

const sectionCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: '1px solid #d9e2f0',
  background: '#ffffff',
  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)',
};

const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
  lineHeight: 1.35,
  fontWeight: 700,
  color: '#111827',
};

const bodyTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.85,
  color: '#1f2937',
};

export const AnalysisDetailDrawer: React.FC<AnalysisDetailDrawerProps> = ({ open, onClose, outcome }) => {
  const handleClose = () => {
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title="推理详情"
      placement="bottom"
      size="large"
      destroyOnClose
      extra={
        <Button type="text" onClick={handleClose} style={{ fontWeight: 600 }}>
          收起详情
        </Button>
      }
      styles={{
        body: {
          padding: 14,
          background: '#f3f6fb',
        },
      }}
    >
      <div style={shellStyle}>
        <section style={sectionCardStyle}>
          <h3 style={sectionHeadingStyle}>本局结论</h3>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>判断来源</span>
              <Tag color={outcome.source === 'rule_fallback' ? 'orange' : 'green'}>{getSourceLabel(outcome.source)}</Tag>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>把握度</span>
              <Tag color="blue">{outcome.confidence_label}把握</Tag>
              <Tag>{Math.round(outcome.confidence * 100)}%</Tag>
            </div>
          </div>
          <p style={{ margin: '14px 0 10px', fontSize: 26, lineHeight: 1.25, fontWeight: 800, color: '#0f172a' }}>本局建议：{outcome.direction}</p>
          <p style={{ ...bodyTextStyle, padding: '12px 14px', borderRadius: 12, background: '#f8fafc' }}>{outcome.short_reason}</p>
        </section>

        <section style={sectionCardStyle}>
          <h3 style={sectionHeadingStyle}>最终为什么押这个方向</h3>
          <p style={{ ...bodyTextStyle, marginTop: 12 }}>{outcome.final_reason}</p>
        </section>

        <section style={sectionCardStyle}>
          <h3 style={sectionHeadingStyle}>五条路怎么看</h3>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {ROAD_KEYS.map((key) => {
              const explanation = outcome.road_explanations[key];

              return (
                <article
                  key={key}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    background: '#fbfdff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{ROAD_LABELS[key]}</h4>
                    {explanation ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Tag color={explanation.tendency === '庄' ? 'red' : explanation.tendency === '闲' ? 'blue' : 'default'}>
                          {explanation.tendency}
                        </Tag>
                        <Tag color="processing">{explanation.support_level}支持</Tag>
                      </div>
                    ) : null}
                  </div>
                  <p style={{ margin: '10px 0 6px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
                    {explanation?.trend_label || '当前暂无这条路的额外解释。'}
                  </p>
                  <p style={bodyTextStyle}>
                    {explanation?.plain_summary || '系统暂时没有拿到这条路的详细说明。'}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section style={sectionCardStyle}>
          <h3 style={sectionHeadingStyle}>来源说明</h3>
          <p style={{ ...bodyTextStyle, marginTop: 12, color: '#475569' }}>
            {getSourceExplanation(outcome)}
          </p>
        </section>

        {outcome.technical_diagnostic?.message ? (
          <section
            style={{
              ...sectionCardStyle,
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              boxShadow: 'none',
            }}
          >
            <Collapse
              ghost
              items={[
                {
                  key: 'technical-diagnostic',
                  label: '技术说明',
                  children: (
                    <p style={{ ...bodyTextStyle, color: '#475569' }}>
                      {outcome.technical_diagnostic.message}
                    </p>
                  ),
                },
              ]}
            />
          </section>
        ) : null}
      </div>
    </Drawer>
  );
};

export default AnalysisDetailDrawer;
