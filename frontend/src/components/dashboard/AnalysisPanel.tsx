/**
 * AnalysisPanel - 智能分析板块组件
 *
 * 包含: 分析状态、极简结果卡
 */
import React, { useState } from 'react';
import { Button, Tag } from 'antd';
import { RobotOutlined, BulbOutlined, AimOutlined } from '@ant-design/icons';
import { useSystemStateQuery } from '../../hooks/useQueries';
import {
  formatAnalysisOutcomeLabel,
  formatAnalysisSourceLabel,
  formatConfidenceLabel,
} from '../../utils/beginnerCopy';
import { toCnAnalysisDiagnostic } from '../../utils/i18nErrors';
import { resolvePredictionMode, type DashboardWorkflowStage } from '../../utils/systemFlowConsistency';
import type { AnalysisData, AnalysisOutcome } from '../../types/models';
import AnalysisDetailDrawer from './AnalysisDetailDrawer';

type AnalysisPanelData = Partial<AnalysisData>;

interface AnalysisPanelProps {
  analysis: AnalysisPanelData | null;
  hasGameData: boolean;
  hasPendingBet: boolean;
  aiAnalyzing: boolean;
  workflowStage: DashboardWorkflowStage;
}

const getConfidenceLabel = (confidence: number) => {
  if (confidence >= 0.7) return '高';
  if (confidence >= 0.55) return '中';
  return '低';
};

const getDirectionColor = (direction?: string | null) => {
  if (direction === '庄') return '#ff7875';
  if (direction === '闲') return '#69b1ff';
  return '#fadb14';
};

const getModeCapsuleLabel = (mode: 'ai' | 'single_ai' | 'rule') => {
  if (mode === 'ai') return '多路综合判断';
  if (mode === 'single_ai') return '智能判断';
  return '规则辅助';
};

const buildLegacyOutcome = (analysis: AnalysisPanelData): AnalysisOutcome | null => {
  const direction = analysis.prediction === '闲' ? '闲' : analysis.prediction === '庄' ? '庄' : null;
  if (!direction) return null;

  const confidence = typeof analysis.confidence === 'number' ? analysis.confidence : 0;
  return {
    direction,
    confidence,
    confidence_label: getConfidenceLabel(confidence),
    source: analysis.prediction_mode === 'rule' ? 'rule_fallback' : 'single_ai',
    short_reason: analysis.combined_summary?.trim() || '系统已完成本局分析。',
    final_reason: analysis.reasoning_detail?.trim() || analysis.combined_summary?.trim() || '当前没有更多分析说明。',
    fallback_reason:
      analysis.prediction_mode === 'rule'
        ? '本局暂未形成稳定判断，系统已切换备用判断，当前流程继续进行。'
        : null,
    road_explanations: {},
    technical_diagnostic: null,
  };
};

const isValidOutcome = (outcome: AnalysisOutcome | null | undefined): outcome is AnalysisOutcome => {
  if (!outcome) return false;
  if (!(outcome.direction === '庄' || outcome.direction === '闲')) return false;
  if (typeof outcome.confidence !== 'number' || Number.isNaN(outcome.confidence)) return false;
  if (!outcome.short_reason?.trim()) return false;
  if (!outcome.final_reason?.trim()) return false;
  return true;
};

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  analysis,
  hasGameData,
  hasPendingBet,
  aiAnalyzing,
  workflowStage,
}) => {
  const { data: systemState } = useSystemStateQuery({});
  const [detailOpen, setDetailOpen] = useState(false);
  const mode = resolvePredictionMode(systemState?.prediction_mode, analysis?.prediction_mode);
  const modeCapsuleLabel = getModeCapsuleLabel(mode);
  const panelShellStyle: React.CSSProperties = {
    minHeight: 'auto',
    borderRadius: 18,
    background:
      'radial-gradient(circle at top left, rgba(37,99,235,0.32), transparent 34%), linear-gradient(135deg, #07111f 0%, #0b1730 52%, #091a2a 100%)',
    border: '1px solid rgba(96,165,250,0.24)',
    boxShadow: '0 18px 42px rgba(2, 6, 23, 0.42), inset 0 1px 0 rgba(148, 163, 184, 0.08)',
  };
  const capsuleStyle: React.CSSProperties = {
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.2,
    border: 'none',
  };

  // 分析中状态 - 三模型进度指示器
  if (workflowStage.showAnalysisLoading || (aiAnalyzing && !hasPendingBet)) {
    return (
      <div className="analysis-card dashboard-section-card dashboard-analysis-card" style={panelShellStyle}>
        <div className="section-header">
          <span style={{ color: '#7dd3fc' }}><BulbOutlined /></span>
          <span className="section-title" style={{ color: '#e0f2fe' }}>智能分析</span>
          <div style={{ marginLeft: 'auto' }}>
            <Tag
              variant="filled"
              style={{
                ...capsuleStyle,
                background: 'rgba(59,130,246,0.18)',
                color: '#bfdbfe',
              }}
            >
              {modeCapsuleLabel}
            </Tag>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '28px 18px 30px' }}>
          <div style={{ fontSize: 28, marginBottom: 12, color: '#60a5fa', textShadow: '0 0 18px rgba(96,165,250,0.48)' }}>
            <RobotOutlined style={{ fontSize: 28 }} />
          </div>
          <div style={{ color: '#e0f2fe', fontSize: 18, fontWeight: 700 }}>系统正在综合比对走势</div>
          <div style={{ color: 'rgba(191,219,254,0.78)', fontSize: 13, marginTop: 10 }}>
            请稍候，判断结果马上出来
          </div>
        </div>
      </div>
    );
  }

  // 等待开奖结果状态
  if (!hasGameData) {
    return (
      <div
        className="analysis-card dashboard-section-card dashboard-analysis-card empty"
        style={{
          ...panelShellStyle,
          padding: 24,
          textAlign: 'center',
          minHeight: 220,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: 'rgba(56,189,248,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, border: '1px solid rgba(125,211,252,0.24)'
        }}>
          <AimOutlined style={{ fontSize: 32, color: '#7dd3fc' }} />
        </div>
        <div style={{ color: '#e6edf3' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#e2e8f0' }}>系统已准备好</div>
          <div style={{ fontSize: 13, color: 'rgba(191,219,254,0.72)', maxWidth: 260, margin: '0 auto' }}>
            请先录入本靴结果，系统会自动开始判断
          </div>
        </div>
      </div>
    );
  }

  if (workflowStage.type === 'waiting_reveal' && !analysis) {
    return (
      <div className="analysis-card dashboard-section-card dashboard-analysis-card" style={panelShellStyle}>
        <div className="section-header">
          <span style={{ color: '#7dd3fc' }}><BulbOutlined /></span>
          <span className="section-title" style={{ color: '#e0f2fe' }}>智能分析</span>
        </div>
        <div style={{ textAlign: 'center', padding: '28px 18px 30px', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 32, marginBottom: 12, color: '#7dd3fc', textShadow: '0 0 18px rgba(125,211,252,0.42)' }}>
            <RobotOutlined style={{ fontSize: 32 }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#bfdbfe' }}>本局已完成下注</div>
          <div style={{ fontSize: 12, color: 'rgba(191,219,254,0.68)' }}>
            等待录入开奖结果
          </div>
        </div>
      </div>
    );
  }

  // 有数据但没有分析结果 - 准备分析
  if (!analysis) {
    return (
      <div className="analysis-card dashboard-section-card dashboard-analysis-card" style={panelShellStyle}>
        <div className="section-header">
          <span style={{ color: '#7dd3fc' }}><BulbOutlined /></span>
          <span className="section-title" style={{ color: '#e0f2fe' }}>智能分析</span>
        </div>
        <div style={{ textAlign: 'center', padding: '28px 18px 30px', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 32, marginBottom: 12, color: '#7dd3fc', textShadow: '0 0 18px rgba(125,211,252,0.42)' }}>
            <RobotOutlined style={{ fontSize: 32 }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#e2e8f0' }}>系统正在整理本局数据</div>
          <div style={{ fontSize: 12, color: 'rgba(191,219,254,0.68)' }}>
            准备开始本局判断
          </div>
        </div>
      </div>
    );
  }

  const explicitOutcome = analysis?.analysis_outcome ?? null;
  const legacyOutcome = explicitOutcome ? null : (analysis ? buildLegacyOutcome(analysis) : null);
  const outcome = isValidOutcome(explicitOutcome) ? explicitOutcome : isValidOutcome(legacyOutcome) ? legacyOutcome : null;

  if (!outcome) {
    return (
      <div className="analysis-card dashboard-section-card dashboard-analysis-card" style={panelShellStyle}>
        <div className="section-header">
          <span style={{ color: '#7dd3fc' }}><BulbOutlined /></span>
          <span className="section-title" style={{ color: '#e0f2fe' }}>智能分析</span>
        </div>
        <div style={{ textAlign: 'center', padding: '28px 18px 30px', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 32, marginBottom: 12, color: '#7dd3fc', textShadow: '0 0 18px rgba(125,211,252,0.42)' }}>
            <RobotOutlined style={{ fontSize: 32 }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#e2e8f0' }}>系统正在整理本局数据</div>
          <div style={{ fontSize: 12, color: 'rgba(191,219,254,0.68)' }}>
            准备开始本局判断
          </div>
        </div>
      </div>
    );
  }

  const direction = outcome?.direction || analysis?.prediction || '--';
  const confidenceValue = outcome?.confidence ?? analysis?.confidence ?? 0;
  const confidenceLabel = outcome?.confidence_label || getConfidenceLabel(confidenceValue);
  const confidencePercent = Math.round(confidenceValue * 100);
  const rawSummary = outcome?.short_reason?.trim() || analysis?.combined_summary?.trim() || '系统已完成本局分析。';
  const summary = toCnAnalysisDiagnostic(rawSummary) || rawSummary;
  const fallbackReason =
    outcome?.source === 'rule_fallback'
      ? toCnAnalysisDiagnostic(outcome.fallback_reason?.trim()) ||
        outcome.fallback_reason?.trim() ||
        '本局暂未形成稳定判断，系统已切换备用判断，当前流程继续进行。'
      : null;
  const decisionTitle = formatAnalysisOutcomeLabel('decision');
  const methodTitle = formatAnalysisOutcomeLabel('method');
  const confidenceTitle = formatConfidenceLabel();
  const detailEntryLabel = formatAnalysisOutcomeLabel('detailAction');
  const sourceLabel = formatAnalysisSourceLabel(outcome?.source ?? 'single_ai');
  const directionGlowColor =
    direction === '庄' ? 'rgba(255,120,117,0.35)' : direction === '闲' ? 'rgba(105,177,255,0.35)' : 'rgba(250,219,20,0.35)';
  const engineLabel =
    outcome?.source === 'rule_fallback'
      ? '本局决断已切换至备用判断，当前流程继续推进。'
      : '本局研判已完成，可继续跟进本局后续状态。';
  const stageHint =
    workflowStage.type === 'waiting_reveal'
      ? '录入本局结果后，将自动衔接下一轮研判'
      : '如需查看更多依据，可展开决断详情';

  return (
    <div className="analysis-card dashboard-section-card dashboard-analysis-card" style={panelShellStyle}>
      <div className="section-header">
        <span style={{ color: '#7dd3fc' }}><BulbOutlined /></span>
        <span className="section-title" style={{ color: '#e0f2fe' }}>智能分析</span>
        <div style={{ marginLeft: 'auto' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#93c5fd',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px rgba(34,197,94,0.7)' }} />
            已完成研判
          </span>
        </div>
      </div>

      <div style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div
          style={{
            padding: '16px 16px 18px',
            borderRadius: 16,
            background: 'linear-gradient(180deg, rgba(15,23,42,0.78) 0%, rgba(8,15,32,0.92) 100%)',
            border: '1px solid rgba(96,165,250,0.22)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', letterSpacing: 0.6 }}>{decisionTitle}</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(191,219,254,0.74)' }}>{decisionTitle}</div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 64,
                  lineHeight: 1,
                  fontWeight: 900,
                  color: getDirectionColor(direction),
                  textShadow: `0 0 24px ${directionGlowColor}`,
                }}
              >
                {direction}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
              <Tag
                variant="filled"
                style={{
                  ...capsuleStyle,
                  background: 'rgba(14,116,144,0.24)',
                  color: '#a5f3fc',
                }}
              >
                {methodTitle}：{sourceLabel}
              </Tag>
              <Tag
                variant="filled"
                style={{
                  ...capsuleStyle,
                  background: 'rgba(30,64,175,0.24)',
                  color: '#bfdbfe',
                }}
              >
                {confidenceTitle}：{confidenceLabel}
              </Tag>
              <Tag
                variant="filled"
                style={{
                  ...capsuleStyle,
                  background: 'rgba(15,23,42,0.66)',
                  color: '#e2e8f0',
                }}
              >
                {confidencePercent}%
              </Tag>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '14px 16px',
            borderRadius: 16,
            background: 'rgba(8, 15, 32, 0.72)',
            border: '1px solid rgba(125,211,252,0.16)',
            color: '#e2e8f0',
            fontSize: 14,
            lineHeight: 1.75,
          }}
        >
          {summary}
        </div>

        {fallbackReason ? (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              background: 'rgba(8,47,73,0.76)',
              border: '1px solid rgba(34,211,238,0.24)',
              color: '#cffafe',
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            {fallbackReason}
          </div>
        ) : null}

        {outcome ? (
          <div>
            <Button
              type="primary"
              onClick={() => setDetailOpen(true)}
              style={{
                borderRadius: 999,
                height: 42,
                paddingInline: 20,
                border: '1px solid rgba(125,211,252,0.28)',
                background: 'linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)',
                boxShadow: '0 12px 28px rgba(37,99,235,0.28)',
              }}
            >
              {detailEntryLabel}
            </Button>
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            fontSize: 12,
            color: 'rgba(191,219,254,0.58)',
          }}
        >
          <span>{engineLabel}</span>
          <span>{stageHint}</span>
        </div>
      </div>
      {outcome ? (
        <AnalysisDetailDrawer
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          outcome={outcome}
        />
      ) : null}
    </div>
  );
};

export default AnalysisPanel;
