import { describe, expect, it } from 'vitest';

import { buildMistakeQueryParams } from './mistakeQuery';

describe('buildMistakeQueryParams', () => {
  it('includes pagination and active filters for the mistakes query', () => {
    expect(buildMistakeQueryParams({
      page: 3,
      pageSize: 50,
      errorType: '趋势误判',
      predictDirection: '庄',
      gameNumberKeyword: '12',
    })).toEqual({
      page: 3,
      pageSize: 50,
      errorType: '趋势误判',
      predictDirection: '庄',
      gameNumberKeyword: '12',
    });
  });

  it('trims empty filters out of the request payload', () => {
    expect(buildMistakeQueryParams({
      page: 1,
      pageSize: 20,
      errorType: '',
      predictDirection: '',
      gameNumberKeyword: '  ',
    })).toEqual({
      page: 1,
      pageSize: 20,
    });
  });
});
