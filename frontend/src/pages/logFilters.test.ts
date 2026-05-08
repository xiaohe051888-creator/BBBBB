import { describe, expect, it } from 'vitest';

import { getLogFiltersFromSearch } from './logFilters';

describe('getLogFiltersFromSearch', () => {
  it('reads priority, task id and keyword from url search params', () => {
    expect(getLogFiltersFromSearch('?priority=P1&task_id=task-1&q=LOG-MDL-002')).toEqual({
      category: '',
      priority: 'P1',
      taskId: 'task-1',
      q: 'LOG-MDL-002',
    });
  });

  it('falls back to empty filters when params are absent', () => {
    expect(getLogFiltersFromSearch('')).toEqual({
      category: '',
      priority: '',
      taskId: '',
      q: '',
    });
  });
});
