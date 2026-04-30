import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldShowDedupe } from './alertDedupe.ts';

test('shouldShowDedupe returns true first time and false for same key within cooldown', () => {
  const now = 1_000_000;
  const cache = {};
  const r1 = shouldShowDedupe({ cache, key: 'boot1:consecutive:20:庄', now, cooldownMs: 60_000 });
  assert.equal(r1.show, true);
  const r2 = shouldShowDedupe({ cache: r1.nextCache, key: 'boot1:consecutive:20:庄', now: now + 10_000, cooldownMs: 60_000 });
  assert.equal(r2.show, false);
});

test('shouldShowDedupe returns true again after cooldown', () => {
  const now = 1_000_000;
  const cache = {};
  const r1 = shouldShowDedupe({ cache, key: 'boot1:consecutive:20:庄', now, cooldownMs: 60_000 });
  const r2 = shouldShowDedupe({ cache: r1.nextCache, key: 'boot1:consecutive:20:庄', now: now + 60_001, cooldownMs: 60_000 });
  assert.equal(r2.show, true);
});

