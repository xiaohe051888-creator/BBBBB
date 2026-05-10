import { describe, expect, it } from 'vitest';

import type { LogEntry } from '../types/models';
import { humanizeLog, toHumanCopyText, toHumanExportPayload } from './logHumanizer';

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
    expect(toHumanCopyText(log)).toContain('变动');
  });

  it('uses decision-hub summary wording in copied text', () => {
    const log: LogEntry = {
      id: 10,
      log_time: '2026-05-02T00:00:00Z',
      game_number: 25,
      event_code: 'LOG-BET-001',
      event_type: '下注',
      event_result: '成功',
      description: '第25局下注庄3030元。',
      category: '资金事件',
      priority: 'P2',
      task_id: null,
      is_pinned: false,
    };

    const text = toHumanCopyText(log);
    expect(text).toContain('变动');
    expect(text).toContain('影响');
    expect(text).toContain('状态');
    expect(text).not.toContain('这次发生了什么');
    expect(text).not.toContain('建议你接下来怎么做');
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

  it('rewrites LOG-MDL-003 into beginner-friendly Chinese without raw timeout text', () => {
    const log: LogEntry = {
      id: 20,
      log_time: '2026-05-10T04:38:55Z',
      game_number: 23,
      event_code: 'LOG-MDL-003',
      event_type: '规则兜底接管',
      event_result: '成功',
      description: '单AI失败后已切换规则兜底继续下注：上传触发分析时发生系统错误: analysis timeout after 45.00s',
      category: '工作流事件',
      priority: 'P1',
      task_id: 'task-23',
      is_pinned: false,
    };
    const h = humanizeLog(log);
    expect(h.title).toBe('智能分析：系统已自动改用备用判断');
    expect(h.whatHappened).toBe('智能判断这次没有及时给出稳定结果，系统已经自动改用备用判断继续完成下注。');
    expect(h.impact).toBe('这次不会中断本局流程，系统已经继续给出最终下注决定。');
    expect(h.suggestion).toBe('无需操作，等待本局开奖结果即可。');
    expect(h.fieldsCn).toEqual(
      expect.arrayContaining([
        { label: '事件', value: '备用判断接手' },
        { label: '事件编码', value: '系统内部识别码' },
        {
          label: '原始说明',
          value: '智能判断这次没有及时给出稳定结果，系统已经自动改用备用判断继续完成下注。',
        },
      ]),
    );
    expect(h.whatHappened).not.toContain('analysis timeout');
    expect(h.whatHappened).not.toContain('单AI');
    expect(h.whatHappened).not.toContain('规则兜底');
  });

  it('rewrites LOG-MDL-002 into chinese without raw timeout or reveal fragments', () => {
    const log: LogEntry = {
      id: 23,
      log_time: '2026-05-10T02:14:34Z',
      game_number: 24,
      event_code: 'LOG-MDL-002',
      event_type: 'AI分析异常',
      event_result: '失败',
      description: '下一局AI分析失败(reveal): analysis timeout after 45.00s',
      category: '系统异常',
      priority: 'P1',
      task_id: 'task-26',
      is_pinned: false,
    };
    const h = humanizeLog(log);
    expect(h.title).toBe('智能分析异常：本次输出已回退为安全结果');
    expect(h.whatHappened).toContain('智能判断');
    expect(h.whatHappened).not.toContain('analysis timeout after 45.00s');
    expect(h.whatHappened).not.toContain('(reveal)');
    expect(h.whatHappened).not.toContain('下一局AI分析失败');
  });

  it('rewrites LOG-MDL-001 into a Chinese judgement summary', () => {
    const log: LogEntry = {
      id: 21,
      log_time: '2026-05-10T04:28:06Z',
      game_number: 23,
      event_code: 'LOG-MDL-001',
      event_type: 'AI分析',
      event_result: '完成',
      description: '🧠 AI对第23局推理完成：预测【庄】 (置信度: 55%)',
      category: 'AI事件',
      priority: 'P2',
      task_id: 'task-24',
      is_pinned: false,
    };
    const h = humanizeLog(log);
    expect(h.title).toBe('智能分析：第23局判断已完成');
    expect(h.whatHappened).toBe('系统已经完成第23局判断，当前建议押庄。');
    expect(h.whatHappened).not.toContain('AI对第23局推理完成');
    expect(h.whatHappened).not.toContain('🧠');
  });

  it('rewrites LOG-BET-001 into a plain Chinese betting summary', () => {
    const log: LogEntry = {
      id: 22,
      log_time: '2026-05-10T04:38:55Z',
      game_number: 23,
      event_code: 'LOG-BET-001',
      event_type: '下注',
      event_result: '已下注庄2500.00元',
      description: '第23局下注庄2500.00元（高档），余额13074.00→10574.00',
      category: '资金事件',
      priority: 'P2',
      task_id: 'task-25',
      is_pinned: false,
    };
    const h = humanizeLog(log);
    expect(h.whatHappened).toBe('系统已经按当前判断完成下注，第23局押庄 2500 元。');
  });

  it('builds export-friendly chinese log payloads', () => {
    const log: LogEntry = {
      id: 30,
      log_time: '2026-05-10T04:38:55Z',
      game_number: 23,
      event_code: 'LOG-MDL-003',
      event_type: '规则兜底接管',
      event_result: '成功',
      description: '单AI失败后已切换规则兜底继续下注：上传触发分析时发生系统错误: analysis timeout after 45.00s',
      category: '工作流事件',
      priority: 'P1',
      task_id: 'task-23',
      is_pinned: false,
    };

    const payload = toHumanExportPayload(log);
    expect(payload['标题']).toBe('智能分析：系统已自动改用备用判断');
    expect(payload['变动']).toBe('智能判断这次没有及时给出稳定结果，系统已经自动改用备用判断继续完成下注。');
    expect(payload['影响']).toBe('这次不会中断本局流程，系统已经继续给出最终下注决定。');
    expect(payload['状态']).toBe('无需操作，等待本局开奖结果即可。');
    expect(Array.isArray(payload['系统记录'])).toBe(true);
    expect(JSON.stringify(payload)).not.toContain('LOG-MDL-003');
    expect(JSON.stringify(payload)).not.toContain('analysis timeout after 45.00s');
    expect(JSON.stringify(payload)).not.toContain('rule_fallback');
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
    expect(h.title).toContain('智能判断连续失准');
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

  it('formats copied human text as a concise decision-hub summary', () => {
    const log: LogEntry = {
      id: 15,
      log_time: '2026-05-09T09:21:47Z',
      game_number: 7,
      event_code: 'LOG-ERR-001',
      event_type: '记入复盘记录',
      event_result: '-',
      description: '第7局预测失准，已将现场盘面与证据链记入复盘记录。连续失准: 2次。',
      category: 'AI事件',
      priority: 'P2',
      task_id: null,
      is_pinned: false,
    };

    const copy = toHumanCopyText(log);
    expect(copy).toContain('标题：');
    expect(copy).toContain('变动：');
    expect(copy).toContain('影响：');
    expect(copy).toContain('状态：');
    expect(copy).not.toContain('发生：');
    expect(copy).not.toContain('建议：');
    expect(copy).not.toContain('时间：');
    expect(copy).not.toContain('编码：系统内部识别码');
  });
});
