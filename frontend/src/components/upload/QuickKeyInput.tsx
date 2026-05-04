import React from 'react';
import { Grid } from 'antd';

export type GameResult = '庄' | '闲' | '和';

type Props = {
  results: GameResult[];
  onChange: (next: GameResult[]) => void;
  max: number;
};

export const QuickKeyInput: React.FC<Props> = ({ results, onChange, max }) => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const resultsRef = React.useRef(results);
  const onChangeRef = React.useRef(onChange);
  const maxRef = React.useRef(max);

  React.useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    maxRef.current = max;
  }, [max]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if ((target as HTMLElement).isContentEditable) return;
      }

      const current = resultsRef.current;
      const maxLen = maxRef.current;

      if (e.key === 'Backspace') {
        if (current.length === 0) return;
        e.preventDefault();
        onChangeRef.current(current.slice(0, -1));
        return;
      }

      if (current.length >= maxLen) return;

      let nextValue: GameResult | null = null;
      if (e.key === '1') nextValue = '庄';
      if (e.key === '2') nextValue = '闲';
      if (e.key === '3') nextValue = '和';
      if (!nextValue) return;

      e.preventDefault();
      onChangeRef.current([...current, nextValue]);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'baseline', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700 }}>快速输入</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>键盘：1=庄 2=闲 3=和，Backspace 撤销最后一局</div>
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', width: isMobile ? '100%' : 'auto' }}>已录入 {results.length}/{max}</div>
    </div>
  );
};
