/**
 * 下注弹窗组件
 */
import React from 'react';
import { Button, Modal, Input } from 'antd';
import { DEFAULT_BET_AMOUNT, MIN_BET_AMOUNT, MAX_BET_AMOUNT } from '../../utils/constants';

interface BetModalProps {
  visible: boolean;
  onCancel: () => void;
  betDirection: '庄' | '闲';
  setBetDirection: (d: '庄' | '闲') => void;
  betAmount: number;
  setBetAmount: (amount: number) => void;
  onConfirm: () => void;
  loading: boolean;
  balance: number;
  analysis: {
    prediction: string | null;
    confidence: number;
    bet_tier: string;
    bet_amount: number | null;
  } | null;
}

const BetModal: React.FC<BetModalProps> = ({
  visible,
  onCancel,
  betDirection,
  setBetDirection,
  betAmount,
  setBetAmount,
  onConfirm,
  loading,
  balance,
  analysis,
}) => {
  return (
    <Modal
      open={visible}
      onCancel={onCancel}
      footer={null}
      centered
      maskStyle={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.75)' }}
      width={420}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🎯</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>确认下注</h2>
      </div>

      {analysis?.prediction && (
        <div style={{
          background: 'rgba(255,215,0,0.08)',
          border: '1px solid rgba(255,215,0,0.2)',
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 20,
          fontSize: 13,
          color: 'rgba(255,255,255,0.85)',
          textAlign: 'center',
        }}>
          🤖 AI推荐下注 <strong style={{ color: '#ffd700' }}>{analysis.prediction}</strong>，
          置信度 <strong style={{ color: '#ffd700' }}>{((analysis.confidence || 0) * 100).toFixed(0)}%</strong>，
          建议档位 <strong style={{ color: '#ffd700' }}>{analysis.bet_tier}</strong>
        </div>
      )}

      {/* 方向选择 */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
        {(['庄', '闲'] as const).map(d => (
          <button
            key={d}
            onClick={() => setBetDirection(d)}
            style={{
              flex: 1,
              height: 72,
              borderRadius: 14,
              border: `2px solid ${betDirection === d ? (d === '庄' ? '#ff4d4f' : '#1890ff') : 'rgba(255,255,255,0.1)'}`,
              background: betDirection === d
                ? (d === '庄' ? 'rgba(255,77,79,0.15)' : 'rgba(24,144,255,0.15)')
                : 'rgba(255,255,255,0.04)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              transform: betDirection === d ? 'scale(1.04)' : 'scale(1)',
            }}
          >
            <span style={{ fontSize: 24, fontWeight: 900, color: d === '庄' ? '#ff4d4f' : '#1890ff' }}>{d}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{d === '庄' ? 'Banker' : 'Player'}</span>
          </button>
        ))}
      </div>

      {/* 金额输入 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
          下注金额（{MIN_BET_AMOUNT}~{MAX_BET_AMOUNT}，10的倍数）
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {[50, 100, 200, 500].map(amt => (
            <button key={amt} onClick={() => setBetAmount(amt)} style={{
              flex: 1, height: 32, borderRadius: 8, border: `1px solid ${betAmount === amt ? '#ffd700' : 'rgba(255,255,255,0.1)'}`,
              background: betAmount === amt ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.04)',
              color: betAmount === amt ? '#ffd700' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>{amt}</button>
          ))}
        </div>
        <Input
          type="number"
          value={betAmount}
          onChange={e => setBetAmount(Math.max(MIN_BET_AMOUNT, Math.min(MAX_BET_AMOUNT, parseInt(e.target.value) || DEFAULT_BET_AMOUNT)))}
          style={{ borderRadius: 10, height: 44 }}
          size="large"
          suffix="元"
        />
      </div>

      {/* 余额提示 */}
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16, textAlign: 'center' }}>
        当前余额：<strong style={{ color: '#73d13d' }}>¥{(balance || 0).toLocaleString()}</strong>
        {betAmount > 0 && (
          <span style={{ marginLeft: 8 }}>
            → 下注后余额：<strong style={{ color: '#fff' }}>¥{((balance || 0) - betAmount).toLocaleString()}</strong>
          </span>
        )}
      </div>

      <Button
        block
        size="large"
        loading={loading}
        onClick={onConfirm}
        style={{
          background: betDirection === '庄'
            ? 'linear-gradient(135deg,#ff4d4f,#cf1322)'
            : 'linear-gradient(135deg,#1890ff,#0050b3)',
          border: 'none',
          color: '#fff',
          fontWeight: 700,
          fontSize: 16,
          height: 52,
          borderRadius: 14,
          boxShadow: betDirection === '庄' ? '0 4px 20px rgba(255,77,79,0.3)' : '0 4px 20px rgba(24,144,255,0.3)',
        }}
      >
        {loading ? '下注中...' : `✅ 确认下注 ${betDirection} ${betAmount}元`}
      </Button>
    </Modal>
  );
};

export default BetModal;
