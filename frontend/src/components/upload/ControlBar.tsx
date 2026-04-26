/**
 * 控制栏组件
 * 桌台选择、局数控制、快捷填充、操作按钮
 */
import React from 'react';
// Modal组件暂未使用
import type { GameResult } from './uploadConstants';
import {
  QUICK_FILLS,
  UploadIcons,
} from './uploadConstants';

interface ControlBarProps {
  rowCount: number;
  onRowCountChange: (n: number) => void;
  onQuickFill: (pattern: GameResult[]) => void;
  onNumberFillClick: () => void;
  onClear: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  rowCount,
  onRowCountChange,
  onQuickFill,
  onNumberFillClick,
  onClear,
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: '16px 20px',
      borderRadius: 16,
      marginBottom: 16,
      background: 'linear-gradient(145deg, rgba(22,29,42,0.9), rgba(15,21,33,0.9))',
      border: '1px solid rgba(255,215,0,0.1)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
    }}>
      {/* 第一行：桌台 + 局数 - 自适应 */}
      <div style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        

        {/* 局数控制 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>局数</span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px',
            borderRadius: 10,
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <button
              onClick={() => onRowCountChange(rowCount - 1)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: 'none',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              {UploadIcons.Minus}
            </button>
            <span style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#ffd700',
              minWidth: 32,
              textAlign: 'center',
            }}>{rowCount}</span>
            <button
              onClick={() => onRowCountChange(rowCount + 1)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                border: 'none',
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              {UploadIcons.Plus}
            </button>
          </div>
          <button
            onClick={() => onRowCountChange(72)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,215,0,0.25)',
              background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,215,0,0.04))',
              color: '#ffd700',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            满72局
          </button>
        </div>
      </div>

      {/* 第二行：快捷填充 + 操作按钮 - 自适应 */}
      <div style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* 快捷填充 */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>快捷</span>
          {QUICK_FILLS.map(f => (
            <button
              key={f.label}
              onClick={() => onQuickFill(f.pattern)}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.65)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>

        {/* 分隔线 */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

        {/* 数字填充按钮 */}
        <button
          onClick={onNumberFillClick}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid rgba(114,46,209,0.4)',
            background: 'linear-gradient(135deg, rgba(114,46,209,0.15), rgba(114,46,209,0.05))',
            color: '#b37feb',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'all 0.15s',
          }}
        >
          {UploadIcons.NumberFill}
          数字填充
        </button>

        {/* 清空按钮 */}
        <button
          onClick={onClear}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid rgba(255,77,79,0.3)',
            background: 'rgba(255,77,79,0.06)',
            color: '#ff7875',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            transition: 'all 0.15s',
          }}
        >
          {UploadIcons.Clear}
          清空
        </button>
      </div>
    </div>
  );
};

export default ControlBar;
