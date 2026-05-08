export interface LogFilterState {
  category: string;
  priority: string;
  taskId: string;
  q: string;
}

export const getLogFiltersFromSearch = (search: string): LogFilterState => {
  const params = new URLSearchParams(search);
  return {
    category: params.get('category') || '',
    priority: params.get('priority') || '',
    taskId: params.get('task_id') || '',
    q: params.get('q') || '',
  };
};
