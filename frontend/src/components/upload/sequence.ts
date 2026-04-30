import type { GameResult } from './QuickKeyInput';

export const cycleGameResult = (v: GameResult): GameResult => {
  if (v === '庄') return '闲';
  if (v === '闲') return '和';
  return '庄';
};

export const toggleResultAt = (results: GameResult[], index: number): GameResult[] => {
  if (index < 0 || index >= results.length) return results;
  const next = results.slice();
  next[index] = cycleGameResult(next[index]);
  return next;
};

export const undoLast = (results: GameResult[]): GameResult[] => {
  if (results.length === 0) return results;
  return results.slice(0, -1);
};

