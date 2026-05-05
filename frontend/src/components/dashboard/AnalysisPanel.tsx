/**
 * AnalysisPanel - 智能分析板块组件
 *
 * 包含: AI三模型分析展示、分析状态
 */
import React, { useMemo, useState } from 'react';
import { Tag, Progress, Button, Drawer, Space } from 'antd';
import { RobotOutlined, BulbOutlined, AimOutlined } from '@ant-design/icons';
import { useSystemStateQuery } from '../../hooks/useQueries';
import { formatAdminModeName, formatAnalysisLoadingText, formatConfidenceLabel } from '../../utils/beginnerCopy';
import { toCnModelLabel } from '../../utils/i18nErrors';

interface Analysis {
  prediction?: string | null;
  confidence?: number;
  bet_tier?: string;
  banker_summary?: string;
  player_summary?: string;
  combined_summary?: string;
  prediction_mode?: 'ai' | 'single_ai' | 'rule';
  engine?: { provider?: string; model?: string; banker?: string | null; player?: string | null; combined?: string | null } | null;
  reasoning_points?: string[];
  reasoning_detail?: string | null;
}

interface AnalysisPanelProps {
  analysis: Analysis | null;
  hasGameData: boolean;
  aiAnalyzing: boolean;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  analysis,
  hasGameData,
  aiAnalyzing,
}) => {
  const { data: systemState } = useSystemStateQuery({});
  const mode = (systemState?.prediction_mode || analysis?.prediction_mode || 'ai') as 'ai' | 'single_ai' | 'rule';
  const [detailOpen, setDetailOpen] = useState(false);
  const reasoningPoints = useMemo(() => (analysis?.reasoning_points || []).filter(Boolean).slice(0, 6), [analysis]);
  const reasoningDetail = analysis?.reasoning_detail || '';
  const engineLabel = useMemo(() => {
    if (mode === 'rule') return '规则参考模式';
    if (mode === 'single_ai') {
      const m = analysis?.engine?.model || '';
      return `单AI快速模式（${toCnModelLabel(m)}）`;
    }
    return '三模型协作模式（庄 / 闲 / 综合）';
  }, [mode, analysis?.engine?.model]);

  // 分析中状态 - 三模型进度指示器
  if (aiAnalyzing) {
    return (
      <div className="analysis-card" style={{ minHeight: 'auto' }}>
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
            <>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, marginBottom: 8, flexWrap: 'wrap' }}>
                {[
                  { name: '庄模型', icon: '庄', color: '#ff4d4f', delay: 0 },
                  { name: '闲模型', icon: '闲', color: '#1890ff', delay: 0.5 },
                  { name: '综合模型', icon: 'AI', color: '#52c41a', delay: 1 },
                ].map((model) => (
                  <div
                    key={model.name}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: `rgba(${model.color === '#ff4d4f' ? '255,77,79' : model.color === '#1890ff' ? '24,144,255' : '82,196,26'}, 0.1)`,
                      border: `1px solid rgba(${model.color === '#ff4d4f' ? '255,77,79' : model.color === '#1890ff' ? '24,144,255' : '82,196,26'}, 0.2)`,
                      animation: `fadeInUp 0.3s ease ${model.delay}s both`,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: model.color }}>{model.icon}</span>
                    <span style={{ fontSize: 10, color: model.color, fontWeight: 600 }}>{model.name}</span>
                    <div
                      style={{
                        width: 40,
                        height: 3,
                        borderRadius: 2,
                        background: 'rgba(255,255,255,0.1)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: model.color,
                          animation: `shimmer 1.5s ease-in-out ${model.delay}s infinite`,
                          transformOrigin: 'left',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 8 }}>
                正在同时参考三套分析结果
              </div>
            </>
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
                正在调用当前单AI配置进行分析
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
      <div className="analysis-card empty" style={{ background: '#1a1d24', borderRadius: 12, padding: 24, textAlign: 'center', minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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

  // 有数据但没有分析结果 - 准备分析
  if (!analysis) {
    return (
      <div className="analysis-card" style={{ minHeight: 'auto' }}>
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

  // 显示分析结果
  const modeTag = (
    <Tag color={mode === 'single_ai' ? 'green' : mode === 'rule' ? 'orange' : 'purple'} style={{ borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
      {mode === 'single_ai' ? '单AI' : mode === 'rule' ? '规则' : '3AI'}
    </Tag>
  );

  const renderReasoning = (compact: boolean) => {
    const hasPoints = reasoningPoints.length > 0;
    const hasDetail = !!reasoningDetail;
    if (!hasPoints && !hasDetail) return null;
    return (
      <div style={{ marginTop: compact ? 10 : 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>推理要点</span>
          {hasDetail && (
            <Button size="small" type="link" style={{ padding: 0, height: 'auto' }} onClick={() => setDetailOpen(true)}>
              查看推理详情
            </Button>
          )}
        </div>
        {hasPoints && (
          <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 1.6 }}>
            {reasoningPoints.map((p, idx) => (
              <li key={`${idx}-${p}`}>{p}</li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="analysis-card" style={{ minHeight: 'auto' }}>
      <div className="section-header">
        <span style={{ color: '#fadb14' }}><BulbOutlined /></span>
        <span className="section-title">智能分析</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {modeTag}
          <Tag color="default" style={{ borderRadius: 12, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            {engineLabel}
          </Tag>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{formatConfidenceLabel()}</span>
          <Progress
            type="circle"
            percent={(analysis.confidence || 0) * 100}
            size={34}
            format={() => `${((analysis.confidence || 0) * 100).toFixed(0)}%`}
            strokeColor={(analysis.confidence || 0) >= 0.7 ? '#52c41a' : '#faad14'}
            railColor="rgba(48,54,68,0.3)"
            strokeWidth={3}
            style={{ fontSize: 10 }}
          />
          <Tag color={analysis.bet_tier === '保守' ? 'orange' : analysis.bet_tier === '进取' ? 'red' : 'blue'}
            style={{ borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
            {analysis.bet_tier || '标准'}档
          </Tag>
        </div>
      </div>

      <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mode !== 'ai' && (
          <div className="model-block model-block-combined" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
              <span className="model-icon-badge" style={{ color: '#52c41a', fontWeight: 700 }}>AI</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#52c41a' }}>{mode === 'rule' ? '规则推演' : '单AI推理'}</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(82,196,26,0.5)', background: 'rgba(82,196,26,0.08)', padding: '1px 8px', borderRadius: 8 }}>
                {engineLabel}
              </span>
            </div>
            <p className="analysis-text" style={{ fontWeight: 500, fontSize: 14 }}>
              {analysis.combined_summary || '暂无综合分析...'}
            </p>
            {renderReasoning(false)}
          </div>
        )}

        {/* 庄模型 */}
        {mode === 'ai' && (
          <div className="model-block model-block-banker">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
            <span className="model-icon-badge" style={{ color: '#ff4d4f', fontWeight: 700 }}>庄</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#ff4d4f' }}>庄模型</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,77,79,0.5)', background: 'rgba(255,77,79,0.08)', padding: '1px 8px', borderRadius: 8 }}>
              庄模型接口
            </span>
          </div>
          <p className="analysis-text">{analysis.banker_summary || '暂无庄向分析...'}</p>
          </div>
        )}

        {/* 闲模型 */}
        {mode === 'ai' && (
          <div className="model-block model-block-player">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
            <span className="model-icon-badge" style={{ color: '#1890ff', fontWeight: 700 }}>闲</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#1890ff' }}>闲模型</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(24,144,255,0.5)', background: 'rgba(24,144,255,0.08)', padding: '1px 8px', borderRadius: 8 }}>
              闲模型接口
            </span>
          </div>
          <p className="analysis-text">{analysis.player_summary || '暂无闲向分析...'}</p>
          </div>
        )}

        {/* 综合模型 */}
        {mode === 'ai' && (
          <div className="model-block model-block-combined" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
            <span className="model-icon-badge" style={{ color: '#52c41a', fontWeight: 700 }}>AI</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#52c41a' }}>综合模型</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(82,196,26,0.5)', background: 'rgba(82,196,26,0.08)', padding: '1px 8px', borderRadius: 8 }}>
              综合模型接口
            </span>
          </div>
          <p className="analysis-text" style={{ fontWeight: 500, fontSize: 14 }}>
            {analysis.combined_summary || '暂无综合分析...'}
          </p>
          {renderReasoning(true)}
          </div>
        )}
      </div>
      <Drawer
        title={
          <Space size={8}>
            <span>推理详情</span>
            {modeTag}
            <Tag color="default" style={{ borderRadius: 12, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              {engineLabel}
            </Tag>
          </Space>
        }
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={520}
        styles={{
          body: { background: '#0d1117', color: 'rgba(255,255,255,0.85)' },
          header: { background: '#0d1117', borderBottom: '1px solid rgba(255,255,255,0.08)' },
          content: { background: '#0d1117' },
        }}
      >
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
          {reasoningDetail || '暂无推理详情'}
        </div>
      </Drawer>
    </div>
  );
};

export default AnalysisPanel;
