import { describe, expect, it } from 'vitest';

import { assertApiTestOk } from './api';

describe('assertApiTestOk', () => {
  it('throws when backend returns success=false', () => {
    expect(() => assertApiTestOk({ success: false, message: 'bad key' })).toThrow('bad key');
  });

  it('does not throw when success=true', () => {
    expect(() => assertApiTestOk({ success: true, message: 'ok' })).not.toThrow();
  });
});

