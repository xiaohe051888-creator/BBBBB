import React from 'react';
import { describe, expect, it } from 'vitest';

import { buildAdminDbTableColumns } from './adminDbColumns';

describe('buildAdminDbTableColumns', () => {
  it('returns log-specific columns for system logs', () => {
    const columns = buildAdminDbTableColumns('system_logs');
    const titles = columns.map((col) => String(col.title));

    expect(titles).toContain('时间');
    expect(titles).toContain('事件');
    expect(titles).toContain('优先级');
    expect(titles).not.toContain('靴号');
    expect(titles).not.toContain('预测');
  });

  it('returns review-specific columns for mistake records', () => {
    const columns = buildAdminDbTableColumns('mistake_book');
    const titles = columns.map((col) => String(col.title));

    expect(titles).toContain('失误类型');
    expect(titles).toContain('预测');
    expect(titles).toContain('实际');
    expect(titles).toContain('原因分析');
    expect(titles).not.toContain('余额');
  });
});
