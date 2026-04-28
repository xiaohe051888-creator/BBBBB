/**
 * DashboardHeader - 顶部状态栏组件
 * 
 * 包含: 系统状态、桌台信息、当前/预测局、余额、健康分、操作按钮
 */
import React from 'react';
import { Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { DollarOutlined, AppstoreOutlined, CloudUploadOutlined, UnlockOutlined, LockOutlined } from '@ant-design/icons';
import { SystemStatusPanel } from '../ui/SystemStatusPanel';
import type { SystemDiagnostics } from '../../hooks/useSystemDiagnostics';
import type { BettingAdvice } from '../../hooks/useSmartDetection';

interface DashboardHeaderProps {
  systemState: {
    status?: string;
    boot_number?: number;
    game_number?: number;
    next_game_number?: number;
    current_game_result?: string | null;
    predict_direction?: string | null;
    balance?: number;
    current_model_version?: string | null;
    pending_bet?: {
      game_number: number;
      direction: string;
      amount: number;
    } | null;
  } | null;
  bettingAdvice: BettingAdvice;
  diagnostics: SystemDiagnostics;
  onDismissIssue: (id: string) => void;
  onRetryConnection: () => void;
  isLoggedIn: boolean;
  onOpenLogin: () => void;
  gameCount: number;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  systemState,
  diagnostics,
  onDismissIssue,
  onRetryConnection,
  isLoggedIn,
  onOpenLogin,
}) => {
  
  const navigate = useNavigate();

  return (
    <div className="top-status-bar" style={{ padding: 'clamp(12px, 2vw, 16px) clamp(16px, 3vw, 24px)', background: 'linear-gradient(180deg, #141b26 0%, #0f151e 100%)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>

        {/* 左侧组：系统信息 + 最新开奖/预测（合并在一边，避免中间空旷） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flex: '1 1 auto' }}>

          {/* 1. 系统状态信息 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.15)', padding: '6px 14px', borderRadius: 20 }}>
                <span style={{ color: '#ffd700', fontSize: 16 }}><AppstoreOutlined /></span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: 0.5 }}>
                  第 <span style={{ color: '#ffd700', fontSize: 16 }}>{systemState?.boot_number || 1}</span> 靴
                </span>
              </div>
          </div>

          {/* 2. 已开局信息 & 下局预测 */}
          <div style={{
            display: 'flex',
            alignItems: 'stretch',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '4px',
            gap: 4,
            flexWrap: 'wrap',
          }}>
            {/* 左半部分：最新开奖 */}
            <div className="latest-result" style={{ padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 }}>最新开奖</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.min(systemState?.game_number || 0, 72)} <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>局</span>
                </span>
                {(systemState?.game_number || 0) >= 72 ? (
                  <div style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 14, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  }}>
                    已结束
                  </div>
                ) : systemState?.current_game_result ? (
                  <div style={{
                    background: systemState.current_game_result === '庄' ? 'rgba(255,77,79,0.2)' : 'rgba(24,144,255,0.2)',
                    border: `1px solid ${systemState.current_game_result === '庄' ? '#ff4d4f' : '#1890ff'}`,
                    color: systemState.current_game_result === '庄' ? '#ff4d4f' : '#1890ff',
                    fontSize: 14, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                  }}>
                    {systemState.current_game_result}
                  </div>
                ) : (
                  <div style={{ width: 28, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>?</span>
                  </div>
                )}
              </div>
            </div>

            {/* 分隔符 */}
            <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 0' }}></div>

            {/* 右半部分：下局预测 */}
            <div className="predict-pulse-container" style={{
              padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              background: 'rgba(255,215,0,0.08)',
              borderRadius: 8,
              border: '1px solid rgba(255,215,0,0.2)',
              boxShadow: '0 0 15px rgba(255,215,0,0.15) inset'
            }}>
              <span style={{ fontSize: 13, color: '#ffd666', letterSpacing: 1, fontWeight: 600 }}>下局预测</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {(systemState?.game_number || 0) >= 72 ? (
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'rgba(255,215,0,0.8)' }}>
                    本靴结束，请新开一靴
                  </span>
                ) : (
                  <>
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#ffd666', fontVariantNumeric: 'tabular-nums' }}>
                      第 {systemState?.next_game_number || (systemState?.game_number || 0) + 1} <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,215,0,0.5)' }}>局</span>
                    </span>
                    {systemState?.predict_direction ? (
                      <div className="predict-result-blink" style={{
                        background: systemState.predict_direction === '庄' ? '#ff4d4f' : systemState.predict_direction === '闲' ? '#1890ff' : '#faad14',
                        color: '#fff', fontSize: 16, fontWeight: 900, padding: '2px 10px', borderRadius: 6,
                        boxShadow: `0 0 12px ${systemState.predict_direction === '庄' ? 'rgba(255,77,79,0.6)' : systemState.predict_direction === '闲' ? 'rgba(24,144,255,0.6)' : 'rgba(250,173,20,0.6)'}`
                      }}>
                        {systemState.predict_direction}
                      </div>
                    ) : (
                      <div style={{ width: 32, height: 24, borderRadius: 6, background: 'rgba(255,215,0,0.05)', border: '1px dashed rgba(255,215,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: 'rgba(255,215,0,0.4)', fontSize: 14, fontWeight: 800 }}>?</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧组：余额 & 操作 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div className="balance-badge" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(82,196,26,0.1)', padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(82,196,26,0.2)' }}>
            <DollarOutlined style={{ color: '#52c41a', fontSize: 16 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#52c41a', fontFamily: 'monospace' }}>
              {systemState?.balance?.toLocaleString() || '0'}
            </span>
          </div>

          <SystemStatusPanel diagnostics={diagnostics} onDismissIssue={onDismissIssue} onRetryConnection={onRetryConnection} compact />

          {/* 操作按钮组（移动端下只显示图标，不显示文字） */}
          <Space size={8} wrap className="mobile-action-group">
            <Button
              icon={<CloudUploadOutlined />}
              onClick={() => navigate('/upload')}
              title="上传数据"
              style={{
                height: 38,
                padding: '0 20px',
                borderRadius: 8,
                fontWeight: 600,
                letterSpacing: 1,
                background: 'rgba(24,144,255,0.1)',
                borderColor: 'rgba(24,144,255,0.3)',
                color: '#1890ff',
              }}
            >
              <span>上传数据</span>
            </Button>

            {isLoggedIn ? (
              <Button
                icon={<UnlockOutlined />}
                onClick={() => navigate('/admin')}
                title="管理员"
                style={{ background: 'rgba(255,215,0,0.08)', borderColor: 'rgba(255,215,0,0.3)', color: '#ffd700', borderRadius: 8, height: 36 }}
              >
                <span>管理员</span>
              </Button>
            ) : (
              <Button
                icon={<LockOutlined />}
                onClick={onOpenLogin}
                title="管理员登录"
                aria-label="管理员登录"
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8, height: 36 }}
              >
                <span>管理员登录</span>
              </Button>
            )}
          </Space>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
