import React from 'react';
import { Grid } from 'antd';

import type { GameResult } from './QuickKeyInput';
import { cycleGameResult } from './sequence';

type Props = {
  results: GameResult[];
  onChange: (next: GameResult[]) => void;
  max: number;
};

export const BeadGridInput: React.FC<Props> = ({ results, onChange, max }) => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const handleClick = (index: number) => {
    if (index > results.length) return;

    if (index === results.length) {
      if (results.length >= max) return;
      onChange([...results, '庄']);
      return;
    }

    const current = results[index];
    const updated = results.slice();
    updated[index] = cycleGameResult(current);
    onChange(updated);
  };

  return (
    <div
      style={{
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: isMobile ? 6 : 0,
      }}
    >
      <div
        style={{
        display: 'grid',
        gridTemplateColumns: `repeat(12, ${isMobile ? 42 : 1}fr)`,
        gridTemplateRows: `repeat(6, ${isMobile ? 42 : 34}px)`,
        gap: isMobile ? 8 : 6,
        padding: 12,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
        minWidth: isMobile ? 12 * 42 + 11 * 8 + 24 : undefined,
      }}
    >
      {Array.from({ length: max }).map((_, idx) => {
        const v = results[idx];
        const bg =
          v === '庄' ? 'rgba(255,77,79,0.18)' :
          v === '闲' ? 'rgba(22,119,255,0.18)' :
          v === '和' ? 'rgba(82,196,26,0.18)' :
          'rgba(255,255,255,0.03)';
        const bd =
          v === '庄' ? 'rgba(255,77,79,0.35)' :
          v === '闲' ? 'rgba(22,119,255,0.35)' :
          v === '和' ? 'rgba(82,196,26,0.35)' :
          'rgba(255,255,255,0.10)';

        return (
          <div
            key={idx}
            onClick={() => handleClick(idx)}
            role="button"
            tabIndex={0}
            style={{
              gridColumn: Math.floor(idx / 6) + 1,
              gridRow: (idx % 6) + 1,
              height: isMobile ? 42 : 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              border: `1px solid ${bd}`,
              background: bg,
              color: v ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.18)',
              fontWeight: 800,
              userSelect: 'none',
              fontVariantNumeric: 'tabular-nums',
              cursor: idx <= results.length ? 'pointer' : 'not-allowed',
              opacity: idx <= results.length ? 1 : 0.35,
              fontSize: isMobile ? 13 : undefined,
            }}
            title={`第 ${idx + 1} 局`}
          >
            {v ?? idx + 1}
          </div>
        );
      })}
      </div>
    </div>
  );
};
