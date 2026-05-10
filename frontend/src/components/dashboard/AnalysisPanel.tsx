/**
 * AnalysisPanel - 智能分析板块组件
 *
 * 包含: 分析状态、极简结果卡
 */
import React, { useState } from 'react';
import { Button, Tag } from 'antd';
import { RobotOutlined, BulbOutlined, AimOutlined } from '@ant-design/icons';
import { useSystemStateQuery } from '../../hooks/useQueries';
import { formatAdminModeName, formatAnalysisLoadingText } from '../../utils/beginnerCopy';
import { toCnModelLabel } from '../../utils/i18nErrors';
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

const getSourceLabel = (source?: AnalysisOutcome['source']) => {
  return source === 'rule_fallback' ? '规则兜底' : '单AI判断';
};

const getDirectionColor = (direction?: string | null) => {
  if (direction === '庄') return '#ff7875';
  if (direction === '闲') return '#69b1ff';
  return '#fadb14';
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
        ? '当前结果来自规则判断，系统已继续执行自动下注。'
        : null,
    road_explanations: {},
    technical_diagnostic: null,
  };
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
  const engineLabel =
    mode === 'rule'
      ? '规则参考模式'
      : mode === 'single_ai'
        ? `单 AI 模式（${toCnModelLabel(analysis?.engine?.model || '')}）`
        : '三模型协作模式（庄 / 闲 / 综合）';

  // 分析中状态 - 三模型进度指示器
  if (workflowStage.showAnalysisLoading || (aiAnalyzing && !hasPendingBet)) {
    return (
      <div className="analysis-card dashboard-section-card dashboard-analysis-card" style={{ minHeight: 'auto' }}>
        <div className="section-header">
          <span style={{ color: '#fadb14' }}><BulbOutlined /></span>
          <span className="section-title">智能分析</span>
          <div style={{ marginLeft: 'auto' }}>
            <Tag color={mode === 'single_ai' ? 'green' : mode === 'rule' ? 'orange' : 'purple'} style={{ borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
              {formatAdminModeName(mode)}
            </Tag>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: 'clamp(20px, 4vw, 32px) 16px' }}>
          <div style={{ fontSize: 28, marginBottom: 12, animation: 'pulse-glow 1.5s infinite', color: '#1890ff' }}>
            <RobotOutlined style={{ fontSize: 28 }} />
          </div>
          <div style={{ color: '#1890ff', fontSize: 14, fontWeight: 600 }}>
            {formatAnalysisLoadingText(mode)}
          </div>
          {mode === 'ai' && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 16 }}>
              正在同时参考三套分析结果
            </div>
          )}
          {mode === 'single_ai' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, marginBottom: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(82,196,26,0.08)',
                    border: '1px solid rgba(82,196,26,0.18)',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#52c41a' }}>AI</span>
                  <span style={{ fontSize: 10, color: '#52c41a', fontWeight: 600 }}>{engineLabel}</span>
                  <div style={{ width: 60, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: '#52c41a', animation: 'shimmer 1.5s ease-in-out infinite', transformOrigin: 'left' }} />
                  </div>
                </div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 8 }}>
                正在使用你当前设置好的单AI进行分析
              </div>
            </>
          )}
          {mode === 'rule' && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 16 }}>
              正在执行长龙跟随与下三路共振判定
            </div>
          )}
        </div>
      </div>
    );
  }

  // 等待开奖结果状态
  if (!hasGameData) {
    return (
      <div className="analysis-card dashboard-section-card dashboard-analysis-card empty" style={{ background: '#1a1d24', borderRadius: 12, padding: 24, textAlign: 'center', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: 'rgba(24,144,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16
        }}>
          <AimOutlined style={{ fontSize: 32, color: '#1890ff' }} />
        </div>
        <div style={{ color: '#e6edf3' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>系统已就绪</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', maxWidth: 250, margin: '0 auto 20px' }}>
            请点击【🎯 开奖】按钮录入第一局结果开始AI分析
          </div>
        </div>
      </div>
    );
  }

  if (workflowStage.type === 'waiting_reveal' && !analysis) {
    return (
      <div className="analysis-card dashboard-section-card dashboard-analysis-card" style={{ minHeight: 'auto' }}>
        <div className="section-header">
          <span style={{ color: '#fadb14' }}><BulbOutlined /></span>
          <span className="section-title">智能分析</span>
        </div>
        <div style={{ textAlign: 'center', padding: 'clamp(24px, 5vw, 40px) 16px', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 32, marginBottom: 12, color: '#faad14' }}>
            <RobotOutlined style={{ fontSize: 32 }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#ffd666' }}>本局已下注</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            等待开奖结果，分析结果同步后会显示在这里
          </div>
        </div>
      </div>
    );
  }

  // 有数据但没有分析结果 - 准备分析
  if (!analysis) {
    return (
      <div className="analysis-card dashboard-section-card dashboard-analysis-card" style={{ minHeight: 'auto' }}>
        <div className="section-header">
          <span style={{ color: '#fadb14' }}><BulbOutlined /></span>
          <span className="section-title">智能分析</span>
        </div>
        <div style={{ textAlign: 'center', padding: 'clamp(24px, 5vw, 40px) 16px', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: 'pulse-glow 2s infinite', color: '#52c41a' }}>
            <RobotOutlined style={{ fontSize: 32 }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>数据已就绪</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
            正在准备AI分析...
          </div>
        </div>
      </div>
    );
  }

  const outcome = analysis?.analysis_outcome || (analysis ? buildLegacyOutcome(analysis) : null);
  const direction = outcome?.direction || analysis?.prediction || '--';
  const confidenceValue = outcome?.confidence ?? analysis?.confidence ?? 0;
  const confidenceLabel = outcome?.confidence_label || getConfidenceLabel(confidenceValue);
  const confidencePercent = Math.round(confidenceValue * 100);
  const summary = outcome?.short_reason?.trim() || analysis?.combined_summary?.trim() || '系统已完成本局分析。';
  const fallbackReason =
    outcome?.source === 'rule_fallback'
      ? outcome.fallback_reason?.trim() || '本局单AI没有及时给出稳定结果，系统已自动切换为规则兜底继续下注。'
      : null;
  const sourceLabel = getSourceLabel(outcome?.source);

  return (
    <div className="analysis-card dashboard-section-card dashboard-analysis-card" style={{ minHeight: 'auto' }}>
      <div className="section-header">
        <span style={{ color: '#fadb14' }}><BulbOutlined /></span>
        <span className="section-title">智能分析</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Tag color={mode === 'single_ai' ? 'green' : mode === 'rule' ? 'orange' : 'purple'} style={{ borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
            {formatAdminModeName(mode)}
          </Tag>
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.4 }}>本局建议</div>
            <div
              style={{
                marginTop: 6,
                fontSize: 56,
                lineHeight: 1,
                fontWeight: 800,
                color: getDirectionColor(direction),
              }}
            >
              {direction}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Tag color={outcome?.source === 'rule_fallback' ? 'orange' : 'green'} style={{ borderRadius: 999, fontWeight: 600 }}>
              {sourceLabel}
            </Tag>
            <Tag color="blue" style={{ borderRadius: 999, fontWeight: 600 }}>
              {confidenceLabel}把握
            </Tag>
            <Tag color="default" style={{ borderRadius: 999, fontWeight: 600 }}>
              {confidencePercent}%
            </Tag>
          </div>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.88)',
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          {summary}
        </div>

        {fallbackReason ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(250,173,20,0.12)',
              border: '1px solid rgba(250,173,20,0.22)',
              color: '#ffd666',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {fallbackReason}
          </div>
        ) : null}

        {outcome ? (
          <div>
            <Button type="link" style={{ paddingInline: 0 }} onClick={() => setDetailOpen(true)}>
              查看详细原因
            </Button>
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          <span>{engineLabel}</span>
          <span>{workflowStage.type === 'waiting_reveal' ? '本局已自动下注，等待开奖结果' : '结果卡已按统一 outcome 渲染'}</span>
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
