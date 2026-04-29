import React from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Card, Space } from 'antd';

import { useSystemStateQuery } from '../hooks';
import { QuickKeyInput, type GameResult } from '../components/upload/QuickKeyInput';
import { BeadGridInput } from '../components/upload/BeadGridInput';
import { UploadConfirmModal, type UploadConfirmValues } from '../components/upload/UploadConfirmModal';
import { uploadGameResultsV2 } from '../services/api';

const MAX_GAMES = 72;

const UploadDataPage: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [results, setResults] = React.useState<GameResult[]>([]);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const { data: systemState } = useSystemStateQuery({});

  const handleDelete = (index: number) => {
    setResults(prev => prev.filter((_, i) => i !== index));
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
      const res = await uploadGameResultsV2({
        games,
        mode: values.action,
        balance_mode: values.balanceMode,
        run_deep_learning: values.action === 'new_boot' ? values.runDeepLearning : undefined,
      });
      setConfirmOpen(false);
      message.success(res.data?.message || '上传成功');
      navigate('/dashboard');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.response?.data?.error || e?.message || '上传失败');
    }
  };

  return (
    <div style={{ padding: '24px 24px 48px' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>上传数据</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>支持 1=庄 2=闲 3=和 与 6×12 珠盘格子录入</div>
        </div>
        <Button onClick={() => navigate('/dashboard')}>返回首页</Button>
      </Space>

      <Card>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 520px', minWidth: 320 }}>
            <QuickKeyInput results={results} onChange={setResults} max={MAX_GAMES} />
            <div style={{ height: 12 }} />
            <BeadGridInput results={results} onChange={setResults} max={MAX_GAMES} />
          </div>

          <div style={{ flex: '1 1 360px', minWidth: 300 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>局序列</div>
              <Button size="small" onClick={() => setResults([])}>清空</Button>
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
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{r}</div>
                    </div>
                    <Button size="small" danger onClick={() => handleDelete(i)}>删除</Button>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" onClick={handleConfirm} disabled={results.length === 0}>
                确认上传
              </Button>
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
      />
    </div>
  );
};

export default UploadDataPage;
