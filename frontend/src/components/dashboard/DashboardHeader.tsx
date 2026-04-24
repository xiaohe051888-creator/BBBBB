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
    if (status === '分析完成') return '#52c41a';
    if (status === '分析中') return '#1890ff';
    return 'rgba(255,255,255,0.5)';
  };

  const getStatusDot = (status?: string) => {
    if (status === '等待开奖') return '#faad14';
    if (status === '分析完成') return '#52c41a';
    if (status === '分析中') return '#1890ff';
    return '#8b949e';
  };

  const getDisplayStatus = (status?: string) => {
    if (!status || status === '空闲') {
      if (gameCount === 0) return '等待开局 (未上传数据)';
      if ((systemState?.game_number || 0) >= 72) return '';
      return '请录入下一局开奖结果';
    }
    if ((systemState?.game_number || 0) >= 72) return '';
    return status;
  };

  return (
    <div className="top-status-bar" style={{ padding: '16px 24px', background: 'linear-gradient(180deg, #141b26 0%, #0f151e 100%)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        
        {/* 左侧：系统信息 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.15)', padding: '6px 14px', borderRadius: 20 }}>
            <span style={{ color: '#ffd700', fontSize: 16 }}><GlobeIcon /></span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', letterSpacing: 0.5 }}>
              第 <span style={{ color: '#ffd700', fontSize: 16 }}>{systemState?.boot_number || 1}</span> 靴
            </span>
          </div>

          {getDisplayStatus(systemState?.status) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="status-indicator-dot" style={{ backgroundColor: getStatusDot(systemState?.status), width: 8, height: 8, borderRadius: '50%', boxShadow: `0 0 8px ${getStatusDot(systemState?.status)}` }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: getStatusColor(systemState?.status) }}>
                {getDisplayStatus(systemState?.status)}
              </span>
            </div>
          )}
        </div>

        {/* 中间：已开局信息 & 预测下一局（玻璃拟物化设计） */}
        <div className="hide-on-mobile" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          background: 'rgba(20, 27, 38, 0.6)', 
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 16, 
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
          padding: '6px 8px',
          gap: 12
        }}>
          {/* 左半部分：当前进度 */}
          <div style={{ padding: '4px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>当前进度</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                {systemState?.game_number || 0} <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)' }}>局</span>
              </span>
              {systemState?.current_game_result ? (
                <div style={{ 
                  background: systemState.current_game_result === '庄' ? 'linear-gradient(135deg, #ff4d4f, #cf1322)' : 'linear-gradient(135deg, #1890ff, #0050b3)',
                  color: '#fff', fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                  boxShadow: systemState.current_game_result === '庄' ? '0 2px 8px rgba(255,77,79,0.3)' : '0 2px 8px rgba(24,144,255,0.3)'
                }}>
                  {systemState.current_game_result}
                </div>
              ) : (
                <div style={{ width: 28, height: 20, borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, fontWeight: 600 }}>?</span>
                </div>
              )}
            </div>
          </div>

          {/* 拟物化连线/箭头指示器 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px' }}>
            <div style={{ width: 24, height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,215,0,0.3))' }}></div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,215,0,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 -4px', filter: 'drop-shadow(0 0 4px rgba(255,215,0,0.4))' }}>
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <div style={{ width: 24, height: 1, background: 'linear-gradient(90deg, rgba(255,215,0,0.3), rgba(255,255,255,0.05))' }}></div>
          </div>

          {/* 右半部分：预测下一局 */}
          <div style={{ 
            padding: '4px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: 'linear-gradient(180deg, rgba(255,215,0,0.08) 0%, transparent 100%)',
            borderRadius: 12, border: '1px solid rgba(255,215,0,0.15)',
            boxShadow: 'inset 0 1px 0 rgba(255,215,0,0.1)'
          }}>
            <span style={{ fontSize: 11, color: '#ffd666', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>预测下一局</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#ffd666', fontVariantNumeric: 'tabular-nums' }}>
                第 {systemState?.next_game_number || (systemState?.game_number || 0) + 1} <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,215,0,0.5)' }}>局</span>
              </span>
              {systemState?.predict_direction ? (
                <div style={{ 
                  background: systemState.predict_direction === '庄' ? 'linear-gradient(135deg, #ff4d4f, #cf1322)' : systemState.predict_direction === '闲' ? 'linear-gradient(135deg, #1890ff, #0050b3)' : 'linear-gradient(135deg, #faad14, #d48806)',
                  color: '#fff', fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}>
                  {systemState.predict_direction}
                </div>
              ) : (
                <div style={{ width: 28, height: 20, borderRadius: 6, background: 'rgba(255,215,0,0.05)', border: '1px dashed rgba(255,215,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'rgba(255,215,0,0.3)', fontSize: 12, fontWeight: 600 }}>?</span>
                </div>
              )}
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
