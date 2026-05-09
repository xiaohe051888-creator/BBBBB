import { describe, expect, it } from 'vitest';
import { formatApiErrorMessage, normalizeBackendDetail } from './errorMessage';

describe('normalizeBackendDetail', () => {
  it('maps illegal_state to Chinese', () => {
    expect(normalizeBackendDetail('illegal_state')).toBe('当前状态不允许该操作，请刷新后重试');
  });

  it('returns null for non-string', () => {
    expect(normalizeBackendDetail({})).toBe(null);
  });

  it('formats FastAPI validation detail arrays into readable text', () => {
    expect(
      formatApiErrorMessage(
        {
          response: {
            data: {
              detail: [
                { msg: 'String should have at least 4 characters' },
                { msg: 'Input should be a valid boolean' },
              ],
            },
          },
          message: 'Request failed with status code 422',
        },
        '创建用户失败'
      )
    ).toBe('String should have at least 4 characters；Input should be a valid boolean');
  });
});
