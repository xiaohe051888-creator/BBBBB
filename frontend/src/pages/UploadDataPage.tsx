import React from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Card, Grid, Space } from 'antd';

import { useSystemStateQuery } from '../hooks';
import { QuickKeyInput, type GameResult } from '../components/upload/QuickKeyInput';
import { BeadGridInput } from '../components/upload/BeadGridInput';
import { UploadConfirmModal, type UploadConfirmValues } from '../components/upload/UploadConfirmModal';
import { uploadGameResultsV2 } from '../services/api';
import { toggleResultAt, undoLast } from '../components/upload/sequence';

const MAX_GAMES = 72;

const UploadDataPage: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [results, setResults] = React.useState<GameResult[]>([]);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const { data: systemState } = useSystemStateQuery({});
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const handleUndoLast = () => {
    setResults(prev => undoLast(prev));
  };

  const handleToggle = (index: number) => {
    setResults(prev => toggleResultAt(prev, index));
  };

  const handleConfirm = () => {
    if (results.length < 1 || results.length > MAX_GAMES) {
      message.error(`局数必须在 1~${MAX_GAMES} 之间`);
      return;
    }
    setConfirmOpen(true);
  };

  const handleSubmit = async (values: UploadConfirmValues) => {
    const games = results.map((r, idx) => ({ game_number: idx + 1, result: r }));
    try {
      setSubmitting(true);
      const res = await uploadGameResultsV2({
        games,
        mode: values.action,
        balance_mode: values.balanceMode,
      });
      setConfirmOpen(false);
      const serverMsg = res.data?.message || '上传成功';
      if (serverMsg.includes('队列') || serverMsg.includes('深度学习')) {
        message.info(serverMsg);
      } else {
        message.success(serverMsg);
      }
      navigate('/dashboard');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string; error?: string } }; message?: string };
      message.error(err?.response?.data?.detail || err?.response?.data?.error || err?.message || '上传失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: isMobile ? '16px 12px 36px' : '24px 24px 48px' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>上传数据</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>支持 1=庄 2=闲 3=和 与 6×12 珠盘格子录入</div>
        </div>
        <Space wrap>
          <Button type="primary" onClick={handleConfirm} disabled={results.length === 0} loading={submitting}>
            确认上传
          </Button>
          <Button onClick={() => navigate('/dashboard')}>返回首页</Button>
        </Space>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.18)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>状态</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{systemState?.status ?? '-'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,215,0,0.18)', background: 'rgba(255,215,0,0.06)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>靴号</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ffd700' }}>{systemState?.boot_number ?? '-'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.18)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>已开局</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{systemState?.game_number ?? '-'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(82,196,26,0.20)', background: 'rgba(82,196,26,0.08)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>余额</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#52c41a', fontFamily: 'monospace' }}>
                {systemState?.balance?.toLocaleString?.() ?? systemState?.balance ?? '-'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
            录入 {results.length}/{MAX_GAMES} 局
          </div>
        </div>

        {systemState?.status === '深度学习中' && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(250,173,20,0.25)',
              background: 'rgba(250,173,20,0.10)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            当前正在深度学习中：如果你此时上传并选择“结束本靴 + 执行深度学习”，系统会把本次数据加入队列，学习完成后自动写入新靴并继续分析。
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display: 'flex', gap: isMobile ? 12 : 16, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={{ flex: '1 1 520px', minWidth: isMobile ? 'auto' : 320 }}>
            <QuickKeyInput results={results} onChange={setResults} max={MAX_GAMES} />
            <div style={{ height: 12 }} />
            <BeadGridInput results={results} onChange={setResults} max={MAX_GAMES} />
          </div>

          <div style={{ flex: '1 1 360px', minWidth: isMobile ? 'auto' : 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>局序列</div>
              <Space size={8}>
                <Button size="small" onClick={handleUndoLast} disabled={results.length === 0}>
                  撤销上一局
                </Button>
                <Button size="small" danger onClick={() => setResults([])} disabled={results.length === 0}>
                  清空
                </Button>
              </Space>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {results.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, padding: '8px 0' }}>
                  暂无数据，请先录入
                </div>
              ) : (
                results.map((r, i) => (
                  <div
                    key={`${i}-${r}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(0,0,0,0.18)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', width: 56 }}>第 {i + 1} 局</div>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => handleToggle(i)}
                        style={{
                          fontSize: 14,
                          fontWeight: 900,
                          color: r === '庄' ? '#ff4d4f' : r === '闲' ? '#1677ff' : '#52c41a',
                          userSelect: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {r}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>点击切换</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>

      <UploadConfirmModal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onSubmit={handleSubmit}
        systemState={systemState}
        gamesCount={results.length}
        submitting={submitting}
      />
    </div>
  );
};

export default UploadDataPage;
