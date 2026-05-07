import React, { useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Space, Tag } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../services/api';
import { isModeSelected, markModeSelected } from '../utils/modeSelection';
import { formatModeSelectLabel } from '../utils/beginnerCopy';

type Mode = 'ai' | 'single_ai' | 'rule';
type ModelEntry = Partial<api.ThreeModelStatus['models']['banker']>;

const ModeSelectPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [threeModelStatus, setThreeModelStatus] = useState<api.ThreeModelStatus | null>(null);
  const [currentMode, setCurrentMode] = useState<Mode>('rule');
  const [showExpiredNotice, setShowExpiredNotice] = useState(() => {
    const expired = searchParams.get('session_expired');
    return expired === 'true' || expired === '1';
  });

  const reloadStatus = async () => {
    setStatusLoading(true);
    try {
      const [statusRes, stateRes] = await Promise.all([
        api.getThreeModelStatus(),
        api.getSystemStatePublic(),
      ]);
      setThreeModelStatus(statusRes.data);
      setCurrentMode((stateRes.data?.prediction_mode as Mode) || 'rule');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加载模型状态失败';
      message.error(msg);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    reloadStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readiness = useMemo(() => {
    const models = threeModelStatus?.models;
    const banker = models?.banker;
    const player = models?.player;
    const combined = models?.combined;
    const single = models?.single;

    const missing3Ai: string[] = [];
    const missingSingle: string[] = [];

    const check = (m: ModelEntry | undefined, label: string, out: string[]) => {
      if (!m?.api_key_set) out.push(`${label}${formatModeSelectLabel('notConfigured')}`);
      else if (!m?.last_test_ok) out.push(`${label}${formatModeSelectLabel('notReady')}`);
    };

    check(banker, '庄模型', missing3Ai);
    check(player, '闲模型', missing3Ai);
    check(combined, '综合模型', missing3Ai);
    check(single, '单AI', missingSingle);

    return {
      aiReady: !!threeModelStatus?.ai_ready_for_enable,
      singleReady: !!threeModelStatus?.single_ai_ready_for_enable,
      missing3Ai,
      missingSingle,
    };
  }, [threeModelStatus]);

  const applyMode = async (mode: Mode) => {
    setLoading(true);
    try {
      await api.updatePredictionMode(mode);
      markModeSelected();
      message.success('模式已启用');
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '切换模式失败';
      message.error(msg);
      await reloadStatus();
    } finally {
      setLoading(false);
    }
  };

  const isCurrentMode = (mode: Mode) => currentMode === mode;

  return (
    <div className="page-wrapper mode-select-page" style={{ padding: 'clamp(16px, 3vw, 28px)', maxWidth: 980, margin: '0 auto' }}>
      {showExpiredNotice && (
        <Alert
          type="warning"
          showIcon
          closable
          title="登录已过期"
          description="请重新选择模式后再进入系统。"
          style={{ marginBottom: 16 }}
          onClose={() => {
            const next = new URLSearchParams(searchParams);
            next.delete('session_expired');
            setSearchParams(next, { replace: true });
            setShowExpiredNotice(false);
          }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: 0.5 }}>选择模式</div>
          <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
            {formatModeSelectLabel('pageHint')}
          </div>
        </div>
        <Space wrap className="mobile-action-row">
          <Button
            onClick={() => {
              const selected = isModeSelected();
              if (!selected) {
                message.warning('请先选择模式后再进入总览');
                return;
              }
              navigate('/dashboard');
            }}
            disabled={loading || statusLoading}
          >
            返回总览
          </Button>
          <Button onClick={reloadStatus} loading={statusLoading} disabled={loading}>刷新状态</Button>
        </Space>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        <Card
          size="small"
          styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.08)' } }}
          title={formatModeSelectLabel('aiCardTitle')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <Space size={6} wrap>
                  {isCurrentMode('ai') && <Tag color="processing">当前</Tag>}
                  {readiness.aiReady ? <Tag color="success">可用</Tag> : <Tag color="error">不可用</Tag>}
                </Space>
              </div>
              {!readiness.aiReady && readiness.missing3Ai.length > 0 && (
                <Alert type="warning" showIcon title={`原因：${readiness.missing3Ai.join('、')}`} />
              )}
            </div>
            <Button type="primary" loading={loading} disabled={isCurrentMode('ai') || !readiness.aiReady || loading} onClick={() => applyMode('ai')}>
              {isCurrentMode('ai') ? '当前模式' : '启用 3AI 模式'}
            </Button>
          </div>
        </Card>

        <Card
          size="small"
          styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.08)' } }}
          title={formatModeSelectLabel('singleCardTitle')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <Space size={6} wrap>
                  {isCurrentMode('single_ai') && <Tag color="processing">当前</Tag>}
                  {readiness.singleReady ? <Tag color="success">可用</Tag> : <Tag color="error">不可用</Tag>}
                </Space>
              </div>
              {!readiness.singleReady && readiness.missingSingle.length > 0 && (
                <Alert type="warning" showIcon title={`原因：${readiness.missingSingle.join('、')}`} />
              )}
            </div>
            <Button type="primary" loading={loading} disabled={isCurrentMode('single_ai') || !readiness.singleReady || loading} onClick={() => applyMode('single_ai')}>
              {isCurrentMode('single_ai') ? '当前模式' : '启用 单AI 模式'}
            </Button>
          </div>
        </Card>

        <Card
          size="small"
          styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.08)' } }}
          title={formatModeSelectLabel('ruleCardTitle')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                <Space size={6} wrap>
                  {isCurrentMode('rule') && <Tag color="processing">当前</Tag>}
                  <Tag color="success">可用</Tag>
                </Space>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                {formatModeSelectLabel('ruleCardHint')}
              </div>
            </div>
            <Button type="primary" loading={loading} disabled={isCurrentMode('rule') || loading} onClick={() => applyMode('rule')}>
              {isCurrentMode('rule') ? '当前模式' : '启用 规则模式'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ModeSelectPage;
