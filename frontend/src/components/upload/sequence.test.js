import test from 'node:test';
import assert from 'node:assert/strict';

import { cycleGameResult, toggleResultAt, undoLast } from './sequence.ts';

test('undoLast removes only the last result', () => {
  assert.deepEqual(undoLast(['庄', '闲', '和']), ['庄', '闲']);
});

test('cycleGameResult loops 庄→闲→和→庄', () => {
  assert.equal(cycleGameResult('庄'), '闲');
  assert.equal(cycleGameResult('闲'), '和');
  assert.equal(cycleGameResult('和'), '庄');
});

test('toggleResultAt changes only selected index and keeps length', () => {
  const next = toggleResultAt(['庄', '闲', '和'], 0);
  assert.deepEqual(next, ['闲', '闲', '和']);
});

