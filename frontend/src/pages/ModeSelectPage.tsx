import React, { useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Space, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';

type Mode = 'ai' | 'single_ai' | 'rule';
type ModelEntry = Partial<api.ThreeModelStatus['models']['banker']>;

const ModeSelectPage: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [threeModelStatus, setThreeModelStatus] = useState<api.ThreeModelStatus | null>(null);

  const reloadStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await api.getThreeModelStatus();
      setThreeModelStatus(res.data);
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
      if (!m?.api_key_set) out.push(`${label}未配置`);
      else if (!m?.last_test_ok) out.push(`${label}未测试通过`);
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
      localStorage.setItem('mode_selected', '1');
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

  return (
    <div style={{ padding: 'clamp(16px, 3vw, 28px)', maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: 0.5 }}>选择模式</div>
          <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
            选择好模式后才会进入系统主界面。AI 模式需要先配置并测试通过。
          </div>
        </div>
        <Space wrap>
          <Button
            onClick={() => {
              const selected = localStorage.getItem('mode_selected') === '1';
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
        <Card size="small" styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.08)' } }} title="3AI 模式（3个大模型）">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                {readiness.aiReady ? <Tag color="success">可用</Tag> : <Tag color="error">不可用</Tag>}
              </div>
              {!readiness.aiReady && readiness.missing3Ai.length > 0 && (
                <Alert type="warning" showIcon message={`原因：${readiness.missing3Ai.join('、')}`} />
              )}
            </div>
            <Button type="primary" loading={loading} disabled={!readiness.aiReady || loading} onClick={() => applyMode('ai')}>
              启用 3AI 模式
            </Button>
          </div>
        </Card>

        <Card size="small" styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.08)' } }} title="单 AI 模式（DeepSeek V4 Pro）">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div>
                {readiness.singleReady ? <Tag color="success">可用</Tag> : <Tag color="error">不可用</Tag>}
              </div>
              {!readiness.singleReady && readiness.missingSingle.length > 0 && (
                <Alert type="warning" showIcon message={`原因：${readiness.missingSingle.join('、')}`} />
              )}
            </div>
            <Button type="primary" loading={loading} disabled={!readiness.singleReady || loading} onClick={() => applyMode('single_ai')}>
              启用 单AI 模式
            </Button>
          </div>
        </Card>

        <Card size="small" styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.08)' } }} title="规则引擎模式（无需配置）">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>
              纯规则预测，不需要任何 API 配置，永远可选。
            </div>
            <Button type="primary" loading={loading} disabled={loading} onClick={() => applyMode('rule')}>
              启用 规则模式
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ModeSelectPage;
