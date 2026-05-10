import React from 'react';
import { Button, Collapse, Drawer, Tag } from 'antd';

import type { AnalysisOutcome } from '../../types/models';
import { formatAnalysisSourceLabel, formatConfidenceLabel } from '../../utils/beginnerCopy';
import { toCnAnalysisDiagnostic } from '../../utils/i18nErrors';

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
  return formatAnalysisSourceLabel(source);
};

const getSourceExplanation = (outcome: AnalysisOutcome) => {
  if (outcome.source === 'rule_fallback') {
    return (
      toCnAnalysisDiagnostic(outcome.fallback_reason) ||
      '智能判断这次没有及时给出稳定结果，系统先用备用判断继续完成这次判断。'
    );
  }

  return '这次判断由智能判断直接完成，系统按结果继续本局流程。';
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
  padding: 18,
  borderRadius: 18,
  border: '1px solid rgba(96, 165, 250, 0.22)',
  background:
    'linear-gradient(180deg, rgba(12, 19, 38, 0.96) 0%, rgba(7, 12, 28, 0.94) 100%)',
  boxShadow: '0 16px 40px rgba(2, 6, 23, 0.42), inset 0 1px 0 rgba(125, 211, 252, 0.08)',
};

const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
  lineHeight: 1.35,
  fontWeight: 700,
  color: '#e0f2fe',
  letterSpacing: 0.3,
};

const bodyTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.85,
  color: 'rgba(226, 232, 240, 0.9)',
};

const metaLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#7dd3fc',
  letterSpacing: 0.5,
};

const metaTagStyle: React.CSSProperties = {
  borderRadius: 999,
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(14, 116, 144, 0.2)',
  color: '#dbeafe',
  fontWeight: 700,
  paddingInline: 10,
};

const getTendencyTagStyle = (tendency: AnalysisOutcome['direction'] | '中性'): React.CSSProperties => {
  if (tendency === '庄') {
    return {
      ...metaTagStyle,
      background: 'rgba(251, 113, 133, 0.18)',
      border: '1px solid rgba(251, 113, 133, 0.28)',
      color: '#fecdd3',
    };
  }

  if (tendency === '闲') {
    return {
      ...metaTagStyle,
      background: 'rgba(96, 165, 250, 0.2)',
      border: '1px solid rgba(96, 165, 250, 0.3)',
      color: '#bfdbfe',
    };
  }

  return {
    ...metaTagStyle,
    background: 'rgba(148, 163, 184, 0.18)',
    border: '1px solid rgba(148, 163, 184, 0.28)',
    color: '#e2e8f0',
  };
};

export const AnalysisDetailDrawer: React.FC<AnalysisDetailDrawerProps> = ({ open, onClose, outcome }) => {
  const handleClose = () => {
    onClose();
  };

  const confidenceTitle = formatConfidenceLabel();
  const sourceLabel = getSourceLabel(outcome.source);
  const sourceExplanation = getSourceExplanation(outcome);
  const diagnosticMessage = toCnAnalysisDiagnostic(outcome.technical_diagnostic?.message);

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title="智能分析详情"
      placement="bottom"
      size="large"
      destroyOnClose
      extra={
        <Button type="text" onClick={handleClose} style={{ fontWeight: 700, color: '#7dd3fc' }}>
          收起详情
        </Button>
      }
      styles={{
        header: {
          background:
            'linear-gradient(180deg, rgba(9, 14, 28, 0.98) 0%, rgba(4, 9, 20, 0.96) 100%)',
          borderBottom: '1px solid rgba(96, 165, 250, 0.2)',
          color: '#e0f2fe',
        },
        section: {
          background:
            'radial-gradient(circle at top, rgba(14, 165, 233, 0.14) 0%, rgba(3, 7, 18, 0.98) 48%), #020617',
        },
        body: {
          padding: 14,
          background:
            'radial-gradient(circle at top, rgba(14, 165, 233, 0.12) 0%, rgba(2, 6, 23, 0.98) 52%), #020617',
        },
      }}
    >
      <div style={shellStyle}>
        <section style={sectionCardStyle}>
          <h3 style={sectionHeadingStyle}>本局结论</h3>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={metaLabelStyle}>判断方式</span>
              <Tag variant="filled" style={metaTagStyle}>
                {sourceLabel}
              </Tag>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={metaLabelStyle}>{confidenceTitle}</span>
              <Tag variant="filled" style={{ ...metaTagStyle, background: 'rgba(30, 64, 175, 0.22)', color: '#bfdbfe' }}>
                {outcome.confidence_label}把握
              </Tag>
              <Tag variant="filled" style={{ ...metaTagStyle, background: 'rgba(15, 23, 42, 0.88)' }}>
                {Math.round(outcome.confidence * 100)}%
              </Tag>
            </div>
          </div>
          <p
            style={{
              margin: '16px 0 10px',
              fontSize: 30,
              lineHeight: 1.2,
              fontWeight: 900,
              color: outcome.direction === '庄' ? '#fda4af' : '#93c5fd',
              textShadow:
                outcome.direction === '庄'
                  ? '0 0 24px rgba(251, 113, 133, 0.4)'
                  : '0 0 24px rgba(96, 165, 250, 0.38)',
            }}
          >
            本局建议：{outcome.direction}
          </p>
          <p
            style={{
              ...bodyTextStyle,
              padding: '13px 14px',
              borderRadius: 14,
              background: 'rgba(15, 23, 42, 0.74)',
              border: '1px solid rgba(125, 211, 252, 0.12)',
            }}
          >
            {outcome.short_reason}
          </p>
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
                    borderRadius: 14,
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.78) 0%, rgba(9, 14, 28, 0.92) 100%)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{ROAD_LABELS[key]}</h4>
                    {explanation ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Tag variant="filled" style={getTendencyTagStyle(explanation.tendency)}>
                          {explanation.tendency}
                        </Tag>
                        <Tag
                          variant="filled"
                          style={{ ...metaTagStyle, background: 'rgba(34, 197, 94, 0.16)', color: '#bbf7d0' }}
                        >
                          {explanation.support_level}支持
                        </Tag>
                      </div>
                    ) : null}
                  </div>
                  <p style={{ margin: '10px 0 6px', fontSize: 14, fontWeight: 600, color: '#cbd5e1' }}>
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
          <h3 style={sectionHeadingStyle}>这次判断来自哪里</h3>
          <p style={{ ...bodyTextStyle, marginTop: 12, color: 'rgba(191, 219, 254, 0.88)' }}>
            {sourceExplanation}
          </p>
        </section>

        {diagnosticMessage ? (
          <section
            style={{
              ...sectionCardStyle,
              background:
                'linear-gradient(180deg, rgba(15, 23, 42, 0.88) 0%, rgba(8, 15, 32, 0.96) 100%)',
              border: '1px solid rgba(125, 211, 252, 0.16)',
              boxShadow: '0 0 0 1px rgba(14, 165, 233, 0.06) inset',
            }}
          >
            <Collapse
              ghost
              style={{ color: '#e2e8f0' }}
              items={[
                {
                  key: 'technical-diagnostic',
                  label: '补充说明',
                  children: (
                    <p style={{ ...bodyTextStyle, color: 'rgba(191, 219, 254, 0.88)' }}>
                      {diagnosticMessage}
                    </p>
                  ),
                },
              ]}
            />
          </section>
        ) : null}

        <section
          style={{
            ...sectionCardStyle,
            position: 'sticky',
            bottom: 0,
            background:
              'linear-gradient(180deg, rgba(10, 14, 27, 0.94) 0%, rgba(4, 8, 20, 0.98) 100%)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(96, 165, 250, 0.18)',
            boxShadow: '0 -16px 30px rgba(2, 6, 23, 0.42)',
          }}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <p style={{ ...bodyTextStyle, color: 'rgba(191, 219, 254, 0.82)' }}>
              如果这一页已经看完了，可以直接从这里收起详情，回到主面板继续看本局状态。
            </p>
            <Button
              type="primary"
              size="large"
              block
              onClick={handleClose}
              style={{
                height: 46,
                border: '1px solid rgba(125, 211, 252, 0.2)',
                background: 'linear-gradient(90deg, #0ea5e9 0%, #2563eb 100%)',
                boxShadow: '0 12px 30px rgba(37, 99, 235, 0.34)',
                fontWeight: 800,
              }}
            >
              看完了，回到主面板
            </Button>
          </div>
        </section>
      </div>
    </Drawer>
  );
};

export default AnalysisDetailDrawer;
