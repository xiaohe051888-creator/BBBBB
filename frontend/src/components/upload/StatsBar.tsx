/**
 * 统计栏组件
 * 显示已填局数、各结果统计
 */
import React from 'react';
import { Tooltip } from 'antd';
import { InfoIcon } from './UploadIcons';

interface StatsBarProps {
  filled: number;
  rowCount: number;
  bankerCount: number;
  playerCount: number;
  tieCount: number;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  filled,
  rowCount,
  bankerCount,
  playerCount,
  tieCount,
}) => {
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: '12px 16px',
      borderRadius: 12,
      marginBottom: 16,
      background: 'linear-gradient(90deg, rgba(22,29,42,0.8), rgba(30,40,60,0.8))',
      border: '1px solid rgba(255,255,255,0.06)',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* 总进度 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: `conic-gradient(#ffd700 ${filled / rowCount * 360}deg, rgba(255,255,255,0.08) 0deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(15,21,33,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ffd700' }}>{filled}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>已填/总局</span>
            <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{filled}/{rowCount}</span>
          </div>
        </div>

        {/* 分隔线 */}
        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />

        {/* 各结果统计 */}
        <div style={{ display: 'flex', gap: 12 }}>
          <Tooltip title="庄">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(255,77,79,0.08)',
              border: '1px solid rgba(255,77,79,0.15)',
            }}>
              <span style={{ fontSize: 11, color: '#ff7875' }}>庄</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#ff4d4f' }}>{bankerCount}</span>
            </div>
          </Tooltip>
          <Tooltip title="闲">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(24,144,255,0.08)',
              border: '1px solid rgba(24,144,255,0.15)',
            }}>
              <span style={{ fontSize: 11, color: '#69c0ff' }}>闲</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1890ff' }}>{playerCount}</span>
            </div>
          </Tooltip>
          <Tooltip title="和">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(82,196,26,0.08)',
              border: '1px solid rgba(82,196,26,0.15)',
            }}>
              <span style={{ fontSize: 11, color: '#95de64' }}>和</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#52c41a' }}>{tieCount}</span>
            </div>
          </Tooltip>
        </div>
      </div>

      {/* 操作提示 */}
      <Tooltip title="点击圆圈切换：庄 → 闲 → 和 → 空">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 6,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <InfoIcon />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            点击圆圈切换结果
          </span>
        </div>
      </Tooltip>
    </div>
  );
};

export default StatsBar;
