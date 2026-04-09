/**
 * 开奖结果输入弹窗组件
 */
import React from 'react';
import { Button, Modal } from 'antd';

interface RevealModalProps {
  visible: boolean;
  onCancel: () => void;
  result: '庄' | '闲' | '和' | '';
  setResult: (result: '庄' | '闲' | '和' | '') => void;
  onConfirm: () => void;
  loading: boolean;
  gameNumber?: number;
}

const RevealModal: React.FC<RevealModalProps> = ({
  visible,
  onCancel,
  result,
  setResult,
  onConfirm,
  loading,
  gameNumber,
}) => {
  const results: Array<{ value: '庄' | '闲' | '和'; label: string; color: string; bg: string }> = [
    { value: '庄', label: '庄赢 Banker', color: '#ff4d4f', bg: 'rgba(255,77,79,0.15)' },
    { value: '闲', label: '闲赢 Player', color: '#1890ff', bg: 'rgba(24,144,255,0.15)' },
    { value: '和', label: '和局 Tie', color: '#52c41a', bg: 'rgba(82,196,26,0.15)' },
  ];

  return (
    <Modal
      open={visible}
      onCancel={onCancel}
      footer={null}
      centered
      maskStyle={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.75)' }}
      width={400}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🎲</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>
          输入开奖结果
        </h2>
        {gameNumber && (
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            第 {gameNumber} 局
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {results.map(r => (
          <button
            key={r.value}
            onClick={() => setResult(r.value)}
            style={{
              height: 56,
              borderRadius: 12,
              border: `2px solid ${result === r.value ? r.color : 'rgba(255,255,255,0.1)'}`,
              background: result === r.value ? r.bg : 'rgba(255,255,255,0.04)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              transition: 'all 0.2s',
            }}
          >
            <span style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: r.color,
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: r.color }}>{r.label}</span>
          </button>
        ))}
      </div>

      <Button
        block
        size="large"
        loading={loading}
        disabled={!result}
        onClick={onConfirm}
        style={{
          background: result
            ? 'linear-gradient(135deg,#52c41a,#389e0d)'
            : 'rgba(255,255,255,0.1)',
          border: 'none',
          color: '#fff',
          fontWeight: 700,
          fontSize: 16,
          height: 52,
          borderRadius: 14,
          boxShadow: result ? '0 4px 20px rgba(82,196,26,0.3)' : 'none',
        }}
      >
        {loading ? '结算中...' : '✅ 确认开奖结果'}
      </Button>
    </Modal>
  );
};

export default RevealModal;
