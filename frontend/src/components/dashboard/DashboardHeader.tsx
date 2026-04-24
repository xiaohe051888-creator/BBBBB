/**
 * DashboardHeader - 顶部状态栏组件
 * 
 * 包含: 系统状态、桌台信息、当前/预测局、余额、健康分、操作按钮
 */
import React from 'react';
import { Button, Tag, Space, Tooltip, Modal } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  UploadIcon,
  LockIcon,
  UnlockIcon,
  GlobeIcon,
  RobotIcon,
  CoinIcon,
  ShieldIcon,
  ArrowRightIcon,
} from '../icons';
import { SystemStatusPanel } from '../ui/SystemStatusPanel';
import type { HealthScoreResponse } from '../../services/api';
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
  gameCount,
}) => {
  
  const navigate = useNavigate();

  const getStatusColor = (status?: string) => {
    if (status === '等待开奖') return '#faad14';
    if (status === '等待下注') return '#52c41a';
    if (status === '分析中') return '#1890ff';
    return 'rgba(255,255,255,0.5)';
  };

  const getStatusDot = (status?: string) => {
    if (status === '等待开奖') return '#faad14';
    if (status === '等待下注') return '#52c41a';
    if (status === '分析中') return '#1890ff';
    return '#8b949e';
  };

  const getDisplayStatus = (status?: string) => {
    if (!status || status === '空闲') {
      return gameCount === 0 ? '待上传数据' : '待操作';
    }
    return status;
  };

  return (
    <div className="top-status-bar" style={{ padding: '16px 24px', background: 'linear-gradient(180deg, #141b26 0%, #0f151e 100%)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        
        {/* 左侧：桌台信息 & 系统状态 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.15)', padding: '6px 14px', borderRadius: 20 }}>
            <span style={{ color: '#ffd700', fontSize: 16 }}><GlobeIcon /></span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: 0.5 }}>
              第 <span style={{ color: '#ffd700', fontSize: 16 }}>{systemState?.boot_number || 1}</span> 靴
              <span style={{ margin: '0 8px', color: 'rgba(255,255,255,0.2)' }}>|</span>
              已开 <span style={{ color: '#fff', fontSize: 16 }}>{systemState?.game_number || 0}</span> 局
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="status-indicator-dot" style={{ backgroundColor: getStatusDot(systemState?.status), width: 8, height: 8, borderRadius: '50%', boxShadow: `0 0 8px ${getStatusDot(systemState?.status)}` }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: getStatusColor(systemState?.status) }}>
              {getDisplayStatus(systemState?.status)}
            </span>
          </div>
        </div>

        {/* 中间：当前局 / 预测局（视觉焦点） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'center' }} className="hide-on-mobile">
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: 16, padding: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ padding: '8px 24px', textAlign: 'center', minWidth: 160 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>当前局</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span>第{systemState?.game_number || 0}局</span>
                {systemState?.current_game_result && (
                  <Tag color={systemState.current_game_result === '庄' ? '#ff4d4f' : '#1890ff'} style={{ margin: 0, fontWeight: 800, borderRadius: 6, fontSize: 14, padding: '0 8px' }}>
                    {systemState.current_game_result}
                  </Tag>
                )}
              </div>
            </div>

            <div style={{ padding: '0 12px', color: 'rgba(255,215,0,0.3)' }}>
              <ArrowRightIcon />
            </div>

            <div style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,140,0,0.05))', borderRadius: 12, padding: '8px 24px', textAlign: 'center', minWidth: 180, border: '1px solid rgba(255,215,0,0.2)', boxShadow: 'inset 0 0 20px rgba(255,215,0,0.05)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,215,0,0.8)', marginBottom: 4 }}>预测下一局</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#ffd666', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span>第{systemState?.next_game_number || (systemState?.game_number || 0) + 1}局</span>
                {systemState?.predict_direction && (
                  <Tag style={{
                    margin: 0,
                    fontWeight: 800,
                    borderRadius: 6,
                    fontSize: 14,
                    padding: '0 8px',
                    background: systemState.predict_direction === '庄' ? 'linear-gradient(135deg,#ff4d4f,#cf1322)' : 'linear-gradient(135deg,#1890ff,#0050b3)',
                    color: '#fff',
                    border: 'none',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}>
                    {systemState.predict_direction}
                  </Tag>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：余额 & 操作 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(115,209,61,0.05)', padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(115,209,61,0.15)' }}>
            <span style={{ fontSize: 16, color: '#73d13d' }}><CoinIcon /></span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#73d13d' }}>
              ¥{(systemState?.balance || 20000).toLocaleString()}
            </span>
          </div>

          <SystemStatusPanel diagnostics={diagnostics} onDismissIssue={onDismissIssue} onRetryConnection={onRetryConnection} compact />

          <Space size={8}>
            <Button
              type="primary"
              danger
              onClick={async () => {
                if (systemState?.status === '深度学习中') {
                  Modal.warning({ title: '操作被拒绝', content: '当前靴正在进行深度学习，请等待完成后再开启新靴。' });
                  return;
                }
                Modal.confirm({
                  title: '结束本靴并开启新靴？',
                  content: '这将会触发深度学习，并进入上传页面录入新靴数据。',
                  onOk: async () => {
                    try {
                      const { endBoot } = await import('../../services/api');
                      await endBoot();
                      navigate('/', { state: { isNewBoot: true } });
                    } catch (e: unknown) {
                      Modal.error({ title: '结束本靴失败', content: (e as Error).message });
                    }
                  }
                });
              }}
              style={{ borderRadius: 8, fontWeight: 600, height: 36, padding: '0 16px' }}
            >
              结束本靴
            </Button>

            <Button
              icon={<UploadIcon />}
              onClick={() => navigate('/', { state: { isNewBoot: false } })}
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8, height: 36 }}
            >
              上传数据
            </Button>

            {isLoggedIn ? (
              <Button
                icon={<UnlockIcon />}
                onClick={() => navigate('/admin')}
                style={{ background: 'rgba(255,215,0,0.08)', borderColor: 'rgba(255,215,0,0.3)', color: '#ffd700', borderRadius: 8, height: 36 }}
              >
                管理员
              </Button>
            ) : (
              <Button
                icon={<LockIcon />}
                onClick={onOpenLogin}
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8, height: 36 }}
              >
                登录
              </Button>
            )}
          </Space>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
