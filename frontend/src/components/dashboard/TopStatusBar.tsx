/**
 * 顶部状态栏组件
 */
import React, { useState } from 'react';
import { Button, Space, Tooltip, Tag, Modal } from 'antd';
import { SystemStatusPanel } from '../ui/SystemStatusPanel';
import { GlobeIcon, RobotIcon, CoinIcon, ShieldIcon, UploadIcon } from '../ui/Icons';
import type { HealthScoreResponse } from '../../services/api';
import type { SystemDiagnostics } from '../../hooks/useSystemDiagnostics';

interface TopStatusBarProps {
  tableId: string | undefined;
  systemState: {
    status?: string | null;
    boot_number?: number | null;
    game_number?: number | null;
    next_game_number?: number | null;
    current_game_result?: string | null;
    predict_direction?: string | null;
    balance?: number | null;
    current_model_version?: string | null;
  } | null;
  games: unknown[];
  healthScore: HealthScoreResponse | null;
  healthScoreLoading: boolean;
  diagnostics: SystemDiagnostics;
  onDismissIssue: (id: string) => void;
  onRetryConnection: () => void;
  onFetchHealthScore: () => void;
  onNavigate: (path: string) => void;
  bettingAdvice: { canBet: boolean; reason?: string | null; suggestedAmount?: number | null };
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  tableId, systemState, games, healthScore, healthScoreLoading, diagnostics,
  onDismissIssue, onRetryConnection, onFetchHealthScore, onNavigate, bettingAdvice,
}) => {
  const [adviceModalOpen, setAdviceModalOpen] = useState(false);
  const getHealthColor = (score: number) => {
    if (score >= 85) return '#52c41a';
    if (score >= 70) return '#faad14';
    if (score >= 50) return '#fa8c16';
    return '#ff4d4f';
  };

  const getStatusColor = (status: string) => {
    if (status === '等待开奖') return '#faad14';
    if (status === '等待下注') return '#52c41a';
    if (status === '分析中') return '#1890ff';
    return 'rgba(255,255,255,0.5)';
  };

  const getStatusDot = (status: string) => {
    if (status === '等待开奖') return '#faad14';
    if (status === '等待下注') return '#52c41a';
    if (status === '分析中') return '#1890ff';
    return '#8b949e';
  };

  const getDisplayStatus = (status: string | null | undefined, gameCount: number) => {
    if (!status || status === '空闲') return gameCount === 0 ? '待上传数据' : '待操作';
    return status;
  };

  return (
    <div className="top-status-bar">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {/* 左侧 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="info-card-mini">
            <div className="status-indicator-dot" style={{ backgroundColor: getStatusDot(systemState?.status || '空闲') }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: getStatusColor(systemState?.status || '') }}>
              {getDisplayStatus(systemState?.status, games.length)}
            </span>
          </div>
          <div className="info-card-mini">
            <span style={{ color: '#58a6ff' }}><GlobeIcon /></span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              <strong style={{ color: '#ffd700', marginRight: 4 }}>{tableId}桌</strong>
              · 第{systemState?.boot_number || 0}靴 · 已{systemState?.game_number || 0}局
            </span>
          </div>
          <div className="info-card-mini">
            <span style={{ color: '#b37feb' }}><RobotIcon /></span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{systemState?.current_model_version || 'v1.0'}</span>
          </div>
        </div>

        {/* 中间 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }} className="hide-on-mobile">
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '8px 18px', textAlign: 'center', minWidth: 140 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 2 }}>当前局</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
              第{systemState?.game_number || 0}局
              {systemState?.current_game_result && (
                <Tag color={systemState.current_game_result === '庄' ? '#ff4d4f' : '#1890ff'} style={{ marginLeft: 8, fontWeight: 800, borderRadius: 6 }}>
                  {systemState.current_game_result}
                </Tag>
              )}
            </div>
          </div>
          <div style={{ color: 'rgba(255,215,0,0.4)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ transform: 'rotate(45deg)' }}>
              <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
            </svg>
          </div>
          <div style={{ background: 'linear-gradient(135deg,rgba(255,215,0,0.06),rgba(255,215,0,0.02))', borderRadius: 12, padding: '8px 18px', textAlign: 'center', minWidth: 170, border: '1px solid rgba(255,215,0,0.1)' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,215,0,0.6)', letterSpacing: 1.5, marginBottom: 2 }}>预测下一局</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#ffd666' }}>
              第{systemState?.next_game_number || (systemState?.game_number || 0) + 1}局
              {systemState?.predict_direction && (
                <Tag style={{ marginLeft: 8, fontWeight: 800, borderRadius: 6, background: systemState.predict_direction === '庄' ? 'linear-gradient(135deg,#ff4d4f,#cf1322)' : 'linear-gradient(135deg,#1890ff,#0050b3)', color: '#fff', border: 'none' }}>
                  {systemState.predict_direction}
                </Tag>
              )}
            </div>
          </div>
        </div>

        {/* 右侧 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="info-card-mini">
            <span style={{ fontSize: 14, color: '#73d13d' }}><CoinIcon /></span>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>余额</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#73d13d' }}>¥{(systemState?.balance || 20000).toLocaleString()}</div>
            </div>
          </div>

          <>
            <div 
              className="info-card-mini" 
              onClick={() => setAdviceModalOpen(true)}
              style={{ 
                background: games.length > 0 
                  ? (bettingAdvice.canBet ? 'rgba(82,196,26,0.08)' : 'rgba(255,77,79,0.08)')
                  : 'rgba(140,140,140,0.08)',
                border: `1px solid ${games.length > 0 
                  ? (bettingAdvice.canBet ? 'rgba(82,196,26,0.2)' : 'rgba(255,77,79,0.2)')
                  : 'rgba(140,140,140,0.2)'}`,
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: 14, color: games.length > 0 ? (bettingAdvice.canBet ? '#52c41a' : '#ff4d4f') : '#8c8c8c' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              </span>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>下注建议</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: games.length > 0 ? (bettingAdvice.canBet ? '#95de64' : '#ff7875') : '#8c8c8c', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {games.length > 0 
                    ? (bettingAdvice.canBet 
                      ? (bettingAdvice.suggestedAmount ? `建议下注¥${bettingAdvice.suggestedAmount}` : '可以下注') 
                      : bettingAdvice.reason)
                    : '等待数据上传'
                  }
                </div>
              </div>
            </div>
            <Modal
              title="下注建议详情"
              open={adviceModalOpen}
              onCancel={() => setAdviceModalOpen(false)}
              footer={[
                <Button key="close" onClick={() => setAdviceModalOpen(false)}>
                  关闭
                </Button>
              ]}
              width={480}
            >
              <div style={{ padding: '16px 0' }}>
                {games.length === 0 ? (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12, 
                    padding: 16,
                    borderRadius: 8,
                    background: 'rgba(140,140,140,0.08)',
                    border: '1px solid rgba(140,140,140,0.3)'
                  }}>
                    <div style={{ 
                      width: 48, 
                      height: 48, 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      background: '#8c8c8c',
                      color: '#fff',
                      fontSize: 24
                    }}>
                      ⏸
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#8c8c8c' }}>
                        等待数据上传
                      </div>
                      <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                        请先上传开奖记录，系统将分析后给出下注建议
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 12, 
                      marginBottom: 20,
                      padding: 16,
                      borderRadius: 8,
                      background: bettingAdvice.canBet ? 'rgba(82,196,26,0.08)' : 'rgba(255,77,79,0.08)',
                      border: `1px solid ${bettingAdvice.canBet ? 'rgba(82,196,26,0.3)' : 'rgba(255,77,79,0.3)'}`
                    }}>
                      <div style={{ 
                        width: 48, 
                        height: 48, 
                        borderRadius: '50%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: bettingAdvice.canBet ? '#52c41a' : '#ff4d4f',
                        color: '#fff',
                        fontSize: 24
                      }}>
                        {bettingAdvice.canBet ? '✓' : '✗'}
                      </div>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: bettingAdvice.canBet ? '#52c41a' : '#ff4d4f' }}>
                          {bettingAdvice.canBet ? '建议下注' : '暂不建议下注'}
                        </div>
                        <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                          {bettingAdvice.canBet 
                            ? (bettingAdvice.suggestedAmount 
                              ? `建议下注金额：¥${bettingAdvice.suggestedAmount.toLocaleString()}` 
                              : '当前条件适合下注')
                            : (bettingAdvice.reason || '存在风险因素')
                          }
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#333' }}>当前状态</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
                          <div style={{ fontSize: 12, color: '#666' }}>当前余额</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#52c41a' }}>
                            ¥{(systemState?.balance || 20000).toLocaleString()}
                          </div>
                        </div>
                        <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
                          <div style={{ fontSize: 12, color: '#666' }}>当前局数</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: '#1890ff' }}>
                            第{systemState?.game_number || 0}局
                          </div>
                        </div>
                      </div>
                    </div>

                    {systemState?.predict_direction && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#333' }}>AI预测</div>
                        <div style={{ 
                          padding: 12, 
                          background: '#f5f5f5', 
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}>
                          <span style={{ fontSize: 14, color: '#666' }}>预测方向：</span>
                          <Tag color={systemState.predict_direction === '庄' ? '#ff4d4f' : '#1890ff'} style={{ fontSize: 14, fontWeight: 600 }}>
                            {systemState.predict_direction}
                          </Tag>
                        </div>
                      </div>
                    )}

                    {!bettingAdvice.canBet && bettingAdvice.reason && (
                      <div style={{ 
                        padding: 12, 
                        background: 'rgba(255,77,79,0.05)', 
                        borderRadius: 6,
                        border: '1px solid rgba(255,77,79,0.2)'
                      }}>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#ff4d4f' }}>⚠️ 风险提示</div>
                        <div style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>
                          {bettingAdvice.reason}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Modal>
          </>

          <Tooltip title={healthScore?.details ? (
            <div style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>系统健康度: {healthScore.health_score}% ({healthScore.status_text})</div>
              <div>AI模型: {healthScore.details.ai_models?.score ?? 0}/{healthScore.details.ai_models?.max ?? 40}分</div>
              <div>数据库: {healthScore.details.database?.score ?? 0}/{healthScore.details.database?.max ?? 30}分</div>
              <div>数据一致性: {healthScore.details.data_consistency?.score ?? 0}/{healthScore.details.data_consistency?.max ?? 20}分</div>
              <div>会话状态: {healthScore.details.session_health?.score ?? 0}/{healthScore.details.session_health?.max ?? 10}分</div>
            </div>
          ) : '加载中...'} styles={{ root: { maxWidth: 320 } }}>
            <div className="info-card-mini" onClick={onFetchHealthScore} style={{ cursor: 'pointer', opacity: healthScoreLoading ? 0.6 : 1 }}>
              <span style={{ color: getHealthColor(healthScore?.health_score ?? 100) }}><ShieldIcon /></span>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>健康分</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: getHealthColor(healthScore?.health_score ?? 100) }}>
                  {healthScoreLoading ? '...' : `${(healthScore?.health_score ?? 100).toFixed(0)}%`}
                </div>
              </div>
            </div>
          </Tooltip>

          <SystemStatusPanel diagnostics={diagnostics} onDismissIssue={onDismissIssue} onRetryConnection={onRetryConnection} compact />

          <Space size={8}>
            <Button icon={<UploadIcon />} onClick={() => onNavigate('/')} style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', borderRadius: 8 }}>上传数据</Button>
          </Space>
        </div>
      </div>
    </div>
  );
};
