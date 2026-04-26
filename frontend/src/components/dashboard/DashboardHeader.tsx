/**
 * DashboardHeader - 顶部状态栏组件
 * 
 * 包含: 系统状态、桌台信息、当前/预测局、余额、健康分、操作按钮
 */
import React, { useState } from 'react';
import { Button, Tag, Space, Tooltip, Modal, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { StopOutlined, ExclamationCircleOutlined, DollarOutlined, RobotOutlined, AppstoreOutlined, CloudUploadOutlined, UnlockOutlined, LockOutlined } from '@ant-design/icons';
import { SystemStatusPanel } from '../ui/SystemStatusPanel';
import type { HealthScoreResponse } from '../../services/api';
import { endBoot } from '../../services/api';
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
  const [isEndBootModalVisible, setIsEndBootModalVisible] = useState(false);
  const [isEndingBoot, setIsEndingBoot] = useState(false);

  const [alertModal, setAlertModal] = useState({
    visible: false,
    type: 'warning' as 'warning' | 'error',
    title: '',
    content: ''
  });

  const handleEndBoot = async () => {
    if (systemState?.status === '深度学习中') {
      setAlertModal({
        visible: true,
        type: 'warning',
        title: '操作被拒绝',
        content: '当前靴正在进行深度学习，请等待完成后再开启新靴。'
      });
      return;
    }
    setIsEndBootModalVisible(true);
  };

  const confirmEndBoot = async () => {
    try {
      setIsEndingBoot(true);
      await endBoot();
      navigate('/', { state: { isNewBoot: true } });
    } catch (e: unknown) {
      setAlertModal({
        visible: true,
        type: 'error',
        title: '结束本靴失败',
        content: (e as Error).message
      });
    } finally {
      setIsEndingBoot(false);
      setIsEndBootModalVisible(false);
    }
  };

  return (
    <div className="top-status-bar" style={{ padding: '16px 24px', background: 'linear-gradient(180deg, #141b26 0%, #0f151e 100%)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>

        {/* 左侧组：系统信息 + 最新开奖/预测（合并在一边，避免中间空旷） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flex: '1 1 auto' }}>

          {/* 1. 系统状态信息 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
            <div style={{ padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 }}>最新开奖</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              padding: '6px 20px', display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(255,215,0,0.08)',
              borderRadius: 8,
              border: '1px solid rgba(255,215,0,0.2)',
              boxShadow: '0 0 15px rgba(255,215,0,0.15) inset'
            }}>
              <span style={{ fontSize: 13, color: '#ffd666', letterSpacing: 1, fontWeight: 600 }}>下局预测</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              type="primary"
              danger
              onClick={handleEndBoot}
              disabled={isEndingBoot}
              icon={<StopOutlined />}
              title="结束本靴"
              style={{
                height: 38,
                padding: '0 20px',
                borderRadius: 8,
                fontWeight: 600,
                letterSpacing: 1,
                boxShadow: '0 4px 12px rgba(245,34,45,0.3)',
                border: 'none',
                background: 'linear-gradient(135deg, #ff4d4f 0%, #cf1322 100%)'
              }}
            >
              <span>结束本靴</span>
            </Button>

            <Button
              icon={<CloudUploadOutlined />}
              onClick={() => navigate('/', { state: { isNewBoot: false } })}
              title="上传数据"
              style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8, height: 36 }}
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
                title="登录"
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8, height: 36 }}
              >
                <span>登录</span>
              </Button>
            )}
          </Space>
        </div>
      </div>

      {/* 深度定制的“结束本靴”暗黑科幻弹窗 */}
      <Modal
        open={isEndBootModalVisible}
        onCancel={() => !isEndingBoot && setIsEndBootModalVisible(false)}
        footer={null}
        closable={false}
        width={440}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        mask={{ closable: !isEndingBoot }}
        styles={{
          mask: { backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0, 0, 0, 0.7)' },
          body: {
            backgroundColor: '#0f1521',
            border: '1px solid rgba(255, 77, 79, 0.3)',
            borderRadius: '16px',
            boxShadow: '0 0 40px rgba(255, 77, 79, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            padding: 0,
            overflow: 'hidden'
          }
        }}
      >
        <div style={{ position: 'relative' }}>
          {/* 顶部警告装饰条 */}
          <div style={{ height: 4, background: 'linear-gradient(90deg, #ff4d4f, #ff7875, #ff4d4f)' }} />
          
          <div style={{ padding: '32px 32px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: '50%', 
                background: 'rgba(255, 77, 79, 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid rgba(255, 77, 79, 0.2)'
              }}>
                <ExclamationCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: 20, fontWeight: 600, letterSpacing: '0.5px' }}>
                  结束本靴并深度学习
                </h3>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6 }}>
                  您即将终结当前的盘面分析。系统会将本靴的完整数据打包，喂给 <strong>AI 综合模型</strong> 进行错题本复盘与特征提取。
                </p>
              </div>
            </div>

            <div style={{ 
              marginTop: 24, 
              padding: '16px', 
              background: 'rgba(0, 0, 0, 0.3)', 
              borderRadius: 8,
              border: '1px dashed rgba(255, 255, 255, 0.1)'
            }}>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.8 }}>
                <li>当前预测缓存将被清空。</li>
                <li>本靴错误记录将永久固化至“血迹地图”。</li>
                <li>操作完成后，系统将自动跳转至新靴上传页。</li>
              </ul>
            </div>
          </div>

          <div style={{ 
            padding: '16px 32px', 
            background: 'rgba(255,255,255,0.02)', 
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12
          }}>
            <Button 
              onClick={() => setIsEndBootModalVisible(false)}
              disabled={isEndingBoot}
              style={{ 
                background: 'transparent', 
                borderColor: 'rgba(255,255,255,0.2)', 
                color: 'rgba(255,255,255,0.8)',
                borderRadius: 8,
                height: 38,
                padding: '0 20px'
              }}
            >
              取消
            </Button>
            <Button 
              type="primary" 
              danger 
              onClick={confirmEndBoot}
              loading={isEndingBoot}
              style={{ 
                borderRadius: 8,
                height: 38,
                padding: '0 24px',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(255, 77, 79, 0.3)'
              }}
            >
              {isEndingBoot ? '深度学习触发中...' : '确认终结'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 全局提示自定义暗黑弹窗（替代 Modal.warning 和 Modal.error） */}
      <Modal
        open={alertModal.visible}
        onCancel={() => setAlertModal(prev => ({ ...prev, visible: false }))}
        footer={null}
        closable={false}
        width={400}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        styles={{
          mask: { backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0, 0, 0, 0.7)' },
          body: {
            backgroundColor: '#0f1521',
            border: `1px solid ${alertModal.type === 'error' ? 'rgba(255, 77, 79, 0.3)' : 'rgba(250, 173, 20, 0.3)'}`,
            borderRadius: '16px',
            boxShadow: `0 0 40px ${alertModal.type === 'error' ? 'rgba(255, 77, 79, 0.15)' : 'rgba(250, 173, 20, 0.15)'}, inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
            padding: 0,
            overflow: 'hidden'
          }
        }}
      >
        <div style={{ position: 'relative' }}>
          {/* 顶部装饰条 */}
          <div style={{ 
            height: 4, 
            background: alertModal.type === 'error' 
              ? 'linear-gradient(90deg, #ff4d4f, #ff7875, #ff4d4f)' 
              : 'linear-gradient(90deg, #faad14, #ffd666, #faad14)' 
          }} />
          
          <div style={{ padding: '32px 32px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: '50%', 
                background: alertModal.type === 'error' ? 'rgba(255, 77, 79, 0.1)' : 'rgba(250, 173, 20, 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0,
                border: `1px solid ${alertModal.type === 'error' ? 'rgba(255, 77, 79, 0.2)' : 'rgba(250, 173, 20, 0.2)'}`
              }}>
                <ExclamationCircleOutlined style={{ fontSize: 24, color: alertModal.type === 'error' ? '#ff4d4f' : '#faad14' }} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: 20, fontWeight: 600, letterSpacing: '0.5px' }}>
                  {alertModal.title}
                </h3>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6 }}>
                  {alertModal.content}
                </p>
              </div>
            </div>
          </div>

          <div style={{ 
            padding: '16px 32px', 
            background: 'rgba(255,255,255,0.02)', 
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <Button 
              type="primary" 
              onClick={() => setAlertModal(prev => ({ ...prev, visible: false }))}
              style={{ 
                background: alertModal.type === 'error' ? '#ff4d4f' : '#faad14',
                borderColor: 'transparent',
                borderRadius: 8,
                height: 38,
                padding: '0 24px',
                fontWeight: 600,
                color: alertModal.type === 'error' ? '#fff' : '#000',
                boxShadow: `0 4px 12px ${alertModal.type === 'error' ? 'rgba(255, 77, 79, 0.3)' : 'rgba(250, 173, 20, 0.3)'}`
              }}
            >
              我知道了
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default DashboardHeader;
