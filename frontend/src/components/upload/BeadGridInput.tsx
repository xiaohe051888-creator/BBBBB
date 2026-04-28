import React from 'react';

import type { GameResult } from './QuickKeyInput';

type Props = {
  results: GameResult[];
  onChange: (next: GameResult[]) => void;
  max: number;
};

const nextValue = (v: GameResult): GameResult | null => {
  if (v === '庄') return '闲';
  if (v === '闲') return '和';
  return null;
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
    const next = nextValue(current);
    if (!next) {
      onChange(results.slice(0, index));
      return;
    }

    const updated = results.slice();
    updated[index] = next;
    onChange(updated);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        gap: 6,
        padding: 12,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      {Array.from({ length: max }).map((_, idx) => {
        const v = results[idx];
        const bg =
          v === '庄' ? 'rgba(255,77,79,0.18)' :
          v === '闲' ? 'rgba(24,144,255,0.18)' :
          v === '和' ? 'rgba(250,173,20,0.18)' :
          'rgba(255,255,255,0.03)';
        const bd =
          v === '庄' ? 'rgba(255,77,79,0.35)' :
          v === '闲' ? 'rgba(24,144,255,0.35)' :
          v === '和' ? 'rgba(250,173,20,0.35)' :
          'rgba(255,255,255,0.10)';

        return (
          <div
            key={idx}
            onClick={() => handleClick(idx)}
            role="button"
            tabIndex={0}
            style={{
              height: 34,
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

