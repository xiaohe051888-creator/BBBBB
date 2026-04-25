/**
 * 珠盘路网格组件
 * 显示可点击的游戏结果输入网格
 */
import React from 'react';
import type { GameResult } from './uploadConstants';
import { RESULT_COLORS, RESULT_BG, BEAD_COLS, BEAD_ROWS } from './uploadConstants';

interface BeadRoadGridProps {
  games: GameResult[];
  rowCount: number;
  onCellClick: (idx: number) => void;
}

export const BeadRoadGrid: React.FC<BeadRoadGridProps> = ({
  games,
  rowCount,
  onCellClick,
}) => {
  // 找到第一个未填写的数据格子的索引
  const firstEmptyIndex = games.findIndex(g => g === '');
  // 如果全都填满了，则返回最大允许点击的索引
  const allowedMaxIndex = firstEmptyIndex === -1 ? games.length : firstEmptyIndex;

  return (
    <div style={{
      padding: '20px 16px',
      borderRadius: 20,
      background: 'linear-gradient(145deg, rgba(22,29,42,0.9), rgba(15,21,33,0.9))',
      border: '1px solid rgba(255,215,0,0.08)',
      marginBottom: 20,
      boxShadow: '0 12px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
      overflowX: 'auto',
    }}>
      {/* 包裹层，保证在极小屏幕下不会把珠子压得太扁，提供横向滚动 */}
      <div style={{ minWidth: 600 }}>
        {/* 珠盘路网格 - 竖排布局 (1/7/13... 一列) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${BEAD_COLS}, 1fr)`,
          gap: 'clamp(4px, 1vw, 8px)',
          maxWidth: '100%',
        }}>
        {Array.from({ length: BEAD_COLS * BEAD_ROWS }).map((_, idx) => {
          // 竖排布局：idx 0 -> game 1, idx 1 -> game 7, idx 6 -> game 2
          const col = idx % BEAD_COLS;
          const row = Math.floor(idx / BEAD_COLS);
          const gameIndex = col * BEAD_ROWS + row;
          const result = games[gameIndex] || '';
          const gameNumber = gameIndex + 1;

          // 强制顺序填写：当前格子如果大于了“第一个空位”的索引，就强制禁用，
          // 防止用户跳跃式乱点。只允许点已经填写的，和紧挨着的下一个空位。
          const isForbiddenBySequence = gameIndex > allowedMaxIndex;
          const isDisabled = gameIndex >= rowCount || isForbiddenBySequence;

          return (
            <button
              key={gameIndex}
              onClick={() => !isDisabled && onCellClick(gameIndex)}
              disabled={isDisabled}
              style={{
                aspectRatio: '1',
                minWidth: 0,
                borderRadius: '50%',
                border: `2px solid ${isDisabled ? 'rgba(255,255,255,0.04)' : (result ? RESULT_COLORS[result] : 'rgba(255,255,255,0.12)')}`,
                background: isDisabled
                  ? 'rgba(255,255,255,0.02)'
                  : (result ? RESULT_BG[result] : 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'),
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                outline: 'none',
                opacity: isDisabled ? 0.25 : 1,
                boxShadow: result
                  ? `0 4px 16px ${RESULT_COLORS[result]}30, inset 0 1px 0 rgba(255,255,255,0.1)`
                  : '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              {result ? (
                <span style={{
                  fontSize: 'clamp(12px, 3vw, 18px)',
                  fontWeight: 800,
                  color: RESULT_COLORS[result],
                  textShadow: `0 0 12px ${RESULT_COLORS[result]}60`,
                }}>
                  {result}
                </span>
              ) : (
                <span style={{
                  fontSize: isDisabled ? 'clamp(10px, 2vw, 12px)' : 'clamp(11px, 2.5vw, 14px)',
                  fontWeight: isDisabled ? 400 : 700,
                  color: isDisabled ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.35)',
                }}>
                  {gameNumber}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 列号标注 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${BEAD_COLS}, 1fr)`,
        gap: 'clamp(4px, 1vw, 8px)',
        marginTop: 8,
      } as React.CSSProperties}>
        {Array.from({ length: BEAD_COLS }).map((_, colIdx) => (
          <div key={colIdx} style={{
            textAlign: 'center',
            fontSize: 10,
            color: 'rgba(255,255,255,0.2)',
            fontWeight: 500,
          }}>
            {colIdx + 1}
          </div>
        ))}
      </div>
      </div>
    </div>
  );
};

export default BeadRoadGrid;
