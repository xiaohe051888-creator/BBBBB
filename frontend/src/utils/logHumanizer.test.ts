import { describe, expect, it } from 'vitest';

import type { LogEntry } from '../types/models';
import { humanizeLog, toHumanCopyText } from './logHumanizer';

describe('logHumanizer', () => {
  it('humanizes known event_code', () => {
    const log: LogEntry = {
      id: 1,
      log_time: '2026-05-02T00:00:00Z',
      game_number: 2,
      event_code: 'LOG-STL-001',
      event_type: '结算',
      event_result: '成功',
      description: '第2局开庄，注单结算：未命中（开庄），盈亏-10，余额990',
      category: '资金事件',
      priority: 'P2',
      task_id: null,
      is_pinned: false,
    };
    const h = humanizeLog(log);
    expect(h.title).toContain('结算');
    expect(h.whatHappened).toContain('第2局');
    expect(toHumanCopyText(log)).toContain('发生了什么');
  });

  it('falls back to generic for unknown event_code', () => {
    const log: LogEntry = {
      id: 2,
      log_time: '2026-05-02T00:00:00Z',
      game_number: null,
      event_code: 'SOME-UNKNOWN',
      event_type: '未知事件',
      event_result: '成功',
      description: 'something happened',
      category: '系统事件',
      priority: 'P3',
      task_id: null,
      is_pinned: false,
    };
    const h = humanizeLog(log);
    expect(h.title).toContain('未知事件');
    expect(h.suggestion.length).toBeGreaterThan(0);
  });

  it('uses beginner-friendly titles for AI learning logs', () => {
    const log: LogEntry = {
      id: 3,
      log_time: '2026-05-02T00:00:00Z',
      game_number: null,
      event_code: 'LOG-AI-002',
      event_type: 'AI学习',
      event_result: '成功',
      description: '模型版本已更新。',
      category: '系统事件',
      priority: 'P3',
      task_id: null,
      is_pinned: false,
    };
    const h = humanizeLog(log);
    expect(h.title).toBe('系统优化：已生成并切换到新版本');
  });
});
