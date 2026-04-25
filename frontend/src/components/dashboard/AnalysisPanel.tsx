/**
 * AnalysisPanel - 智能分析板块组件
 *
 * 包含: AI三模型分析展示、分析状态
 */
import React from 'react';
import { Tag, Progress, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  RobotIcon,
  BulbIcon,
  UploadIcon,
  CloudUploadIcon,
} from '../icons';
import { useSystemStateQuery } from '../../hooks/useQueries';

interface Analysis {
  prediction?: string | null;
  confidence?: number;
  bet_tier?: string;
  banker_summary?: string;
  player_summary?: string;
  combined_summary?: string;
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
  const navigate = useNavigate();
  const { data: systemState } = useSystemStateQuery({});
  const isRuleMode = systemState?.prediction_mode === 'rule';

  // 分析中状态 - 三模型进度指示器
  if (aiAnalyzing) {
    return (
      <div className="analysis-card" style={{ minHeight: 'auto' }}>
        <div className="section-header">
          <span style={{ color: '#fadb14' }}><BulbIcon /></span>
          <span className="section-title">智能分析</span>
        </div>
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 28, marginBottom: 12, animation: 'pulse-glow 1.5s infinite', color: '#1890ff' }}>
            <RobotIcon width={28} height={28} />
          </div>
          <div style={{ color: '#1890ff', fontSize: 14, fontWeight: 600 }}>
            {isRuleMode ? '量化规则引擎正在进行毫秒级推演...' : 'AI三模型正在深度交叉分析中...'}
          </div>
          
          {!isRuleMode && (
            <>
              {/* 三模型进度指示器 */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, marginBottom: 8 }}>
                {[
                  { name: '庄模型', icon: 'B', color: '#ff4d4f', delay: 0 },
                  { name: '闲模型', icon: 'P', color: '#1890ff', delay: 0.5 },
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
                正在并行调用 OpenAI · Claude · Gemini
              </div>
            </>
          )}
          {isRuleMode && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 16 }}>
              正在执行长龙跟随与下三路共振判定
            </div>
          )}
        </div>
      </div>
    );
  }

  // 等待数据上传状态
  if (!hasGameData) {
    return (
      <div className="analysis-card" style={{ minHeight: 'auto' }}>
        <div className="section-header">
          <span style={{ color: '#fadb14' }}><BulbIcon /></span>
          <span className="section-title">智能分析</span>
        </div>
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
            <CloudUploadIcon width={48} height={48} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>等待数据上传</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 16 }}>
            系统已就绪，请上传开奖记录开始AI分析
          </div>
          <Button
            type="primary"
            icon={<UploadIcon />}
            onClick={() => navigate("/")}
            style={{ borderRadius: 6 }}
          >
            上传数据
          </Button>
        </div>
      </div>
    );
  }

  // 有数据但没有分析结果 - 准备分析
  if (!analysis) {
    return (
      <div className="analysis-card" style={{ minHeight: 'auto' }}>
        <div className="section-header">
          <span style={{ color: '#fadb14' }}><BulbIcon /></span>
          <span className="section-title">智能分析</span>
        </div>
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'rgba(255,255,255,0.4)' }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: 'pulse-glow 2s infinite', color: '#52c41a' }}>
            <RobotIcon width={32} height={32} />
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
  return (
    <div className="analysis-card" style={{ minHeight: 'auto' }}>
      <div className="section-header">
        <span style={{ color: '#fadb14' }}><BulbIcon /></span>
        <span className="section-title">智能分析</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>置信度</span>
          <Progress
            type="circle"
            percent={(analysis.confidence || 0) * 100}
            size={34}
            format={() => `${((analysis.confidence || 0) * 100).toFixed(0)}%`}
            strokeColor={(analysis.confidence || 0) >= 0.7 ? '#52c41a' : '#faad14'}
            trailColor="rgba(48,54,68,0.3)"
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
        {/* 庄模型 */}
        <div className="model-block model-block-banker">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
            <span className="model-icon-badge" style={{ color: '#ff4d4f', fontWeight: 700 }}>B</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#ff4d4f' }}>庄模型</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,77,79,0.5)', background: 'rgba(255,77,79,0.08)', padding: '1px 8px', borderRadius: 8 }}>
              OpenAI GPT-4o mini
            </span>
          </div>
          <p className="analysis-text">{analysis.banker_summary || '暂无庄向分析...'}</p>
        </div>

        {/* 闲模型 */}
        <div className="model-block model-block-player">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
            <span className="model-icon-badge" style={{ color: '#1890ff', fontWeight: 700 }}>P</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#1890ff' }}>闲模型</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(24,144,255,0.5)', background: 'rgba(24,144,255,0.08)', padding: '1px 8px', borderRadius: 8 }}>
              Claude Sonnet 4
            </span>
          </div>
          <p className="analysis-text">{analysis.player_summary || '暂无闲向分析...'}</p>
        </div>

        {/* 综合模型 */}
        <div className="model-block model-block-combined" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
            <span className="model-icon-badge" style={{ color: '#52c41a', fontWeight: 700 }}>AI</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#52c41a' }}>综合模型</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(82,196,26,0.5)', background: 'rgba(82,196,26,0.08)', padding: '1px 8px', borderRadius: 8 }}>
              Gemini Flash
            </span>
          </div>
          <p className="analysis-text" style={{ fontWeight: 500, fontSize: 14 }}>
            {analysis.combined_summary || '暂无综合分析...'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;
