import React from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Card, Space } from 'antd';

import { QuickKeyInput, type GameResult } from '../components/upload/QuickKeyInput';
import { BeadGridInput } from '../components/upload/BeadGridInput';

const MAX_GAMES = 72;

const UploadDataPage: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [results, setResults] = React.useState<GameResult[]>([]);

  const handleDelete = (index: number) => {
    setResults(prev => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    if (results.length < 1 || results.length > MAX_GAMES) {
      message.error(`局数必须在 1~${MAX_GAMES} 之间`);
      return;
    }
    message.info('确认上传弹窗开发中');
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
    </div>
  );
};

export default UploadDataPage;
