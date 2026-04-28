import React from 'react';

import type { GameResult } from './QuickKeyInput';

type Props = {
  results: GameResult[];
  onChange: (next: GameResult[]) => void;
  max: number;
};

const nextValue = (v: GameResult | undefined): GameResult | undefined => {
  if (!v) return '庄';
  if (v === '庄') return '闲';
  if (v === '闲') return '和';
  return undefined;
};

export const BeadGridInput: React.FC<Props> = ({ results, onChange, max }) => {
  const handleClick = (index: number) => {
    if (index > results.length) return;

    if (index === results.length) {
      if (results.length >= max) return;
      onChange([...results, '庄']);
      return;
    }

    const current = results[index];
    const n = nextValue(current);
    if (!n) {
      onChange(results.slice(0, index));
      return;
    }
    const copy = results.slice();
    copy[index] = n;
    onChange(copy);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gridTemplateRows: 'repeat(6, 34px)',
        gridAutoFlow: 'column',
        gap: 6,
        padding: 12,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      {Array.from({ length: max }).map((_, idx) => {
        const v = results[idx];
        const isNext = idx === results.length && results.length < max;
        const isDisabled = idx > results.length;
        const bg =
          v === '庄' ? 'rgba(255,77,79,0.18)' :
          v === '闲' ? 'rgba(24,144,255,0.18)' :
          v === '和' ? 'rgba(250,173,20,0.18)' :
          isNext ? 'rgba(24,144,255,0.06)' :
          'rgba(255,255,255,0.03)';
        const bd =
          v === '庄' ? 'rgba(255,77,79,0.35)' :
          v === '闲' ? 'rgba(24,144,255,0.35)' :
          v === '和' ? 'rgba(250,173,20,0.35)' :
          isNext ? 'rgba(24,144,255,0.20)' :
          'rgba(255,255,255,0.10)';

        return (
          <div
            key={idx}
            onClick={() => !isDisabled && handleClick(idx)}
            style={{
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              border: `1px solid ${bd}`,
              background: bg,
              color: v ? 'rgba(255,255,255,0.92)' : isDisabled ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.25)',
              fontWeight: 800,
              userSelect: 'none',
              fontVariantNumeric: 'tabular-nums',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.55 : 1,
            }}
            title={`第 ${idx + 1} 局`}
          >
            {v ?? idx + 1}
          </div>
        );
      })}
    </div>
  );
};
