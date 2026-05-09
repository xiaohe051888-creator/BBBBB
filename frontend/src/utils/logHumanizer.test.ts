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

  it('uses beginner-friendly wording for learning progress logs', () => {
    const log: LogEntry = {
      id: 4,
      log_time: '2026-05-02T00:00:00Z',
      game_number: null,
      event_code: 'LOG-BOOT-002',
      event_type: 'AI学习',
      event_result: '成功',
      description: '',
      category: '系统事件',
      priority: 'P3',
      task_id: null,
      is_pinned: false,
    };
    const h = humanizeLog(log);
    expect(h.whatHappened).toBe('系统学习优化已完成。');
  });

  it('uses beginner-friendly wording for combined analysis logs', () => {
    const log: LogEntry = {
      id: 7,
      log_time: '2026-05-02T00:00:00Z',
      game_number: 12,
      event_code: 'LOG-MDL-003',
      event_type: 'AI分析',
      event_result: '成功',
      description: '',
      category: '系统事件',
      priority: 'P3',
      task_id: null,
      is_pinned: false,
    };
    const h = humanizeLog(log);
    expect(h.whatHappened).toBe('综合判断结果已生成。');
  });

  it('uses beginner-friendly wording for watchdog-related logs', () => {
    const log: LogEntry = {
      id: 8,
      log_time: '2026-05-02T00:00:00Z',
      game_number: null,
      event_code: 'LOG-WDG-002',
      event_type: '系统守护',
      event_result: '告警',
      description: '',
      category: '系统事件',
      priority: 'P2',
      task_id: null,
      is_pinned: false,
    };
    const h = humanizeLog(log);
    expect(h.title).toBe('系统守护：检测到系统处理积压');
    expect(h.whatHappened).toBe('系统处理出现排队积压。');
  });

  it('uses beginner-friendly field labels for task ids', () => {
    const log: LogEntry = {
      id: 9,
      log_time: '2026-05-02T00:00:00Z',
      game_number: 8,
      event_code: 'LOG-SYS-001',
      event_type: '上传',
      event_result: '成功',
      description: 'ok',
      category: '系统事件',
      priority: 'P3',
      task_id: 'task-123',
      is_pinned: false,
    };
    const h = humanizeLog(log);
    expect(h.fieldsCn.some((field) => field.label === '处理编号' && field.value === 'task-123')).toBe(true);
  });

  it('describes LOG-ERR-001 as an AI review alert instead of a settlement failure', () => {
    const log: LogEntry = {
      id: 10,
      log_time: '2026-05-09T09:53:29Z',
      game_number: 8,
      event_code: 'LOG-ERR-001',
      event_type: '记入复盘记录',
      event_result: '-',
      description: '第8局预测失准，已将现场盘面与证据链记入复盘记录。连续失准: 3次。',
      category: 'AI事件',
      priority: 'P2',
      task_id: null,
      is_pinned: false,
    };
    const h = humanizeLog(log);
    expect(h.title).toContain('AI连续失准');
    expect(h.impact).not.toContain('余额/下注记录不一致');
    expect(toHumanCopyText(log)).not.toContain('系统异常：结算过程出现问题');
  });

  it('does not suggest a nonexistent one-click repair action in known repair-related logs', () => {
    const cases: LogEntry[] = [
      {
        id: 11,
        log_time: '2026-05-09T10:00:00Z',
        game_number: null,
        event_code: 'LOG-SYS-ERR',
        event_type: '系统异常',
        event_result: '失败',
        description: '自动流程发生异常。',
        category: '系统事件',
        priority: 'P1',
        task_id: null,
        is_pinned: false,
      },
      {
        id: 12,
        log_time: '2026-05-09T10:00:00Z',
        game_number: null,
        event_code: 'LOG-RECOVER-002',
        event_type: '系统恢复',
        event_result: '成功',
        description: '系统将状态回落到可继续操作的状态。',
        category: '系统事件',
        priority: 'P2',
        task_id: null,
        is_pinned: false,
      },
      {
        id: 13,
        log_time: '2026-05-09T10:00:00Z',
        game_number: null,
        event_code: 'LOG-WDG-003',
        event_type: '系统守护',
        event_result: '告警',
        description: '最近一段时间出现较多高优先级事件。',
        category: '系统事件',
        priority: 'P2',
        task_id: null,
        is_pinned: false,
      },
    ];

    for (const log of cases) {
      const copy = toHumanCopyText(log);
      expect(copy).not.toContain('一键修复');
      expect(copy).not.toContain('系统修复');
    }
  });

  it('does not mention a missing repair button in generic LOG-ERR suggestions', () => {
    const log: LogEntry = {
      id: 14,
      log_time: '2026-05-09T10:00:00Z',
      game_number: null,
      event_code: 'LOG-ERR-999',
      event_type: '未知异常',
      event_result: '失败',
      description: '任务执行失败。',
      category: '系统事件',
      priority: 'P1',
      task_id: null,
      is_pinned: false,
    };

    const copy = toHumanCopyText(log);
    expect(copy).not.toContain('一键修复');
    expect(copy).not.toContain('系统修复');
    expect(copy).toContain('刷新页面');
  });
});
