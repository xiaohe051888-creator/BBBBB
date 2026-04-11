/**
 * 桌台选择按钮组件
 */
import React from 'react';
import { Icons } from './StartIcons';

interface TableButtonProps {
  tableId: string;
  loading: boolean;
  onClick: () => void;
  variant: 'red' | 'blue';
}

export const TableButton: React.FC<TableButtonProps> = ({
  tableId,
  loading,
  onClick,
  variant,
}) => {
  const isRed = variant === 'red';
  const TableIcon = isRed ? Icons.Table26 : Icons.Table27;

  return (
    <button
      disabled={loading}
      onClick={onClick}
      style={{
        height: 72,
        borderRadius: 14,
        border: 'none',
        outline: 'none',
        background: loading
          ? `linear-gradient(135deg, ${isRed ? '#9e2a38' : '#0e5aa7'} 0%, ${isRed ? '#7a1a26' : '#0a4080'} 100%)`
          : `linear-gradient(135deg, ${isRed ? '#dc3545' : '#1890ff'} 0%, ${isRed ? '#c41d33' : '#096dd9'} 100%)`,
        boxShadow: loading
          ? 'none'
          : `0 6px 24px ${isRed ? 'rgba(220, 53, 69, 0.35)' : 'rgba(24, 144, 255, 0.35)'}, inset 0 1px 0 rgba(255,255,255,0.1)`,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        transition: 'all 0.2s',
        width: '100%',
      }}
    >
      <TableIcon />
      <div style={{ textAlign: 'left' }}>
        <div style={{ 
          color: '#fff', 
          fontSize: 17, 
          fontWeight: 700, 
          letterSpacing: '0.5px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {loading ? (
            <>
              <Icons.Loading />
              加载中...
            </>
          ) : `${tableId} 桌`}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }}>
          点击进入 · 手动上传开奖记录
        </div>
      </div>
    </button>
  );
};
