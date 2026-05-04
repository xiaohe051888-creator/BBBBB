/**
 * 开奖结果输入弹窗组件 - 精致图标、中文全站
 */
import React, { useEffect, useCallback } from 'react';
import { Button, Grid, Modal } from 'antd';

interface RevealModalProps {
  visible: boolean;
  onCancel: () => void;
  result: '庄' | '闲' | '和' | '';
  setResult: (result: '庄' | '闲' | '和' | '') => void;
  onConfirm: () => void;
  loading: boolean;
  gameNumber?: number;
}

// 精致图标
const Icons = {
  Dice: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-6C6.67 12 6 11.33 6 10.5S6.67 9 7.5 9 9 9.67 9 10.5 8.33 12 7.5 12zm6 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-6c-.83 0-1.5-.67-1.5-1.5S12.67 9 13.5 9s1.5.67 1.5 1.5S14.33 12 13.5 12zm6 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-6c-.83 0-1.5-.67-1.5-1.5S19.67 9 20.5 9s1.5.67 1.5 1.5S21.33 12 20.5 12z"/>
    </svg>
  ),
  Check: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  Loading: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
    </svg>
  ),
};

const RevealModal: React.FC<RevealModalProps> = ({
  visible,
  onCancel,
  result,
  setResult,
  onConfirm,
  loading,
  gameNumber,
}) => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const results: Array<{ value: '庄' | '闲' | '和'; label: string; desc: string; color: string; bg: string }> = React.useMemo(() => ([
    { value: '庄', label: '庄赢', desc: '记为庄方胜出', color: '#ff4d4f', bg: 'rgba(255,77,79,0.15)' },
    { value: '闲', label: '闲赢', desc: '记为闲方胜出', color: '#1890ff', bg: 'rgba(24,144,255,0.15)' },
    { value: '和', label: '和局', desc: '记为本局打和', color: '#52c41a', bg: 'rgba(82,196,26,0.15)' },
  ]), []);

  const modalStyles = React.useMemo(() => ({
    mask: { backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.75)' }
  }), []);

  const modalOuterStyle = React.useMemo(() => ({
    maxWidth: 'calc(100vw - 32px)'
  }), []);

  // 键盘快捷键支持
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!visible || loading) return;
    
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onCancel();
        break;
      case 'Enter':
        e.preventDefault();
        if (result) onConfirm();
        break;
      case '1':
      case 'b':
      case 'B':
        e.preventDefault();
        setResult('庄');
        break;
      case '2':
      case 'p':
      case 'P':
        e.preventDefault();
        setResult('闲');
        break;
      case '3':
      case 't':
      case 'T':
        e.preventDefault();
        setResult('和');
        break;
    }
  }, [visible, loading, onCancel, onConfirm, setResult, result]);

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, handleKeyDown]);

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={400}
      style={modalOuterStyle}
      centered
      closable={false}
      styles={modalStyles}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ 
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(82,196,26,0.2), rgba(82,196,26,0.08))',
          border: '1px solid rgba(82,196,26,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
          color: '#52c41a',
        }}>
          <Icons.Dice />
        </div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>
          输入开奖结果
        </h2>
        {gameNumber && (
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            第 {gameNumber} 局
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {results.map(r => (
          <button
            key={r.value}
            onClick={() => setResult(r.value)}
            style={{
              minHeight: isMobile ? 62 : 54,
              borderRadius: 12,
              border: `2px solid ${result === r.value ? r.color : 'rgba(255,255,255,0.1)'}`,
              background: result === r.value ? r.bg : 'rgba(255,255,255,0.04)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'all 0.2s',
              flexWrap: 'wrap',
              padding: isMobile ? '10px 12px' : undefined,
            }}
          >
            <span style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: r.color,
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: r.color }}>{r.label}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: isMobile ? '100%' : 'auto', textAlign: 'center' }}>{r.desc}</span>
          </button>
        ))}
      </div>

      <Button
        block
        size="large"
        loading={loading}
        disabled={!result}
        onClick={onConfirm}
        aria-label="确认开奖"
        style={{
          background: result
            ? 'linear-gradient(135deg,#52c41a,#389e0d)'
            : 'rgba(255,255,255,0.1)',
          border: 'none',
          color: '#fff',
          fontWeight: 700,
          fontSize: 15,
          height: 50,
          borderRadius: 12,
          boxShadow: result ? '0 4px 20px rgba(82,196,26,0.3)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {loading ? (
          <><Icons.Loading /> 结算中...</>
        ) : (
          <><Icons.Check /> 确认开奖结果</>
        )}
      </Button>
    </Modal>
  );
};

export default RevealModal;
