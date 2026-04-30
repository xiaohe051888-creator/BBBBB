import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeBackendDetail } from './errorMessage.ts';

test('normalizeBackendDetail maps illegal_state to Chinese', () => {
  assert.equal(normalizeBackendDetail('illegal_state'), '当前状态不允许该操作，请刷新后重试');
});

test('normalizeBackendDetail returns null for non-string', () => {
  assert.equal(normalizeBackendDetail({}), null);
});

