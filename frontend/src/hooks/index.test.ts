import { describe, expect, it } from 'vitest';

import * as hooks from './index';

describe('hooks barrel exports', () => {
  it('does not expose the legacy workflow state hook', () => {
    expect('useWorkflowState' in hooks).toBe(false);
  });
});
