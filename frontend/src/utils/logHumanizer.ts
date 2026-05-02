import type { LogEntry } from '../types/models';

export type HumanLogField = { label: string; value: string };

export type HumanLog = {
  title: string;
  whatHappened: string;
  impact: string;
  suggestion: string;
  fieldsCn: HumanLogField[];
};

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const priorityCn = (p: string): string =>
  p === 'P0' ? '致命' : p === 'P1' ? '严重' : p === 'P2' ? '警告' : p === 'P3' ? '信息' : '未知';

const isErrorPriority = (p: string): boolean => p === 'P0' || p === 'P1';

const baseFields = (log: LogEntry): HumanLogField[] => [
  { label: '时间', value: s(log.log_time) || '-' },
  { label: '靴内局号', value: log.game_number === null ? '-' : String(log.game_number) },
  { label: '事件', value: s(log.event_type) || '-' },
  { label: '结果', value: s(log.event_result) || '-' },
  { label: '类别', value: s(log.category) || '-' },
  { label: '严重程度', value: priorityCn(s(log.priority)) },
  { label: '事件编码', value: s(log.event_code) || '-' },
  { label: '任务编号', value: s(log.task_id) || '-' },
];

type Rule = (log: LogEntry) => Omit<HumanLog, 'fieldsCn'>;

const rule: Record<string, Rule> = {
  'LOG-SYS-001': (log) => ({
    title: '数据上传：已同步开奖记录',
    whatHappened: s(log.description) || '已完成数据上传。',
    impact: '会刷新开奖记录与走势，并触发后续分析/下注流程。',
    suggestion: '无需操作，等待系统自动分析即可。',
  }),
  'LOG-SYS-003': (log) => ({
    title: '系统重置：已清理并重新开始',
    whatHappened: s(log.description) || '系统进行了重置清理。',
    impact: '会清空本靴相关数据并重置流程状态。',
    suggestion: '如果是你主动点的“覆盖本靴/新靴”，属于正常现象；否则建议查看最近操作记录。',
  }),
  'LOG-SYS-BAL': (log) => ({
    title: '管理员调账：余额已调整',
    whatHappened: s(log.description) || '管理员修改了余额。',
    impact: '会影响后续下注金额与盈亏统计。',
    suggestion: '如非你本人操作，建议立即修改管理员密码。',
  }),
  'LOG-SYS-ERR': (log) => ({
    title: '系统异常：自动分析失败',
    whatHappened: s(log.description) || '自动流程发生异常。',
    impact: '可能导致状态停留在“分析中/错误”，影响后续下注或开奖。',
    suggestion: '建议回到首页查看系统状态，必要时点击“一键修复/刷新页面”后重试。',
  }),
  'LOG-STL-001': (log) => ({
    title: `结算：第${log.game_number ?? '-'}局已结算`,
    whatHappened: s(log.description) || '本局已完成结算。',
    impact: '会更新余额与下注记录；输赢属于正常业务结果。',
    suggestion: '无需操作，继续录入下一局即可。',
  }),
  'LOG-RECOVER-001': (log) => ({
    title: '系统恢复：已自动取消未完成任务',
    whatHappened: s(log.description) || '服务重启后系统自动清理未完成任务。',
    impact: '避免重启后出现“卡住/重复运行”。',
    suggestion: '一般无需处理；如果频繁出现，说明服务可能在重启，建议检查部署环境。',
  }),
  'LOG-RECOVER-002': (log) => ({
    title: '系统恢复：已把状态回落到安全状态',
    whatHappened: s(log.description) || '系统将状态回落到可继续操作的状态。',
    impact: '避免状态卡在“分析中/深度学习中”。',
    suggestion: '一般无需处理；如仍无法继续操作，点击“刷新”或“一键修复”。',
  }),
  'LOG-RECOVER-003': (log) => ({
    title: '系统修复：已从卡住状态恢复',
    whatHappened: s(log.description) || '系统检测到状态卡住并已自动修复。',
    impact: '解除卡住后可以继续开奖/上传等流程。',
    suggestion: '无需操作；如反复出现，建议减少频繁刷新，或反馈给维护人员排查。',
  }),
  'LOG-WDG-001': (log) => ({
    title: '系统守护：自动修复已执行',
    whatHappened: s(log.description) || 'Watchdog 执行了自动修复。',
    impact: '用于自动把系统从异常/卡住状态拉回正常。',
    suggestion: '无需处理；如大量出现，说明系统经常卡住，建议排查后台任务或网络。',
  }),
  'LOG-WDG-002': (log) => ({
    title: '系统守护：检测到后台任务积压',
    whatHappened: s(log.description) || '后台任务出现积压。',
    impact: '可能导致分析/学习变慢，页面出现延迟。',
    suggestion: '建议稍候再试；如持续出现，建议重启服务或降低并发操作。',
  }),
  'LOG-WDG-003': (log) => ({
    title: '系统守护：最近错误次数偏多',
    whatHappened: s(log.description) || '最近一段时间出现较多高优先级事件。',
    impact: '提示系统近期不稳定或操作频繁。',
    suggestion: '可先观察；若影响使用，建议点击“系统修复/刷新页面”。',
  }),
  'LOG-WDG-RET': (log) => ({
    title: '系统维护：清理任务失败',
    whatHappened: s(log.description) || '日志/历史数据清理失败。',
    impact: '一般不影响下注/开奖，但可能导致数据增长过快。',
    suggestion: '建议联系维护人员查看后端日志。',
  }),
  'LOG-WDG-ERR': (log) => ({
    title: '系统守护：Watchdog 执行异常',
    whatHappened: s(log.description) || 'Watchdog 执行发生异常。',
    impact: '可能导致无法自动修复卡住状态。',
    suggestion: '建议联系维护人员排查。',
  }),
  'LOG-BOOT-001': (log) => ({
    title: '结束本靴：已开启新靴',
    whatHappened: s(log.description) || '本靴结束并开启了新靴。',
    impact: '从第1局重新开始录入/分析。',
    suggestion: '无需操作，继续录入新靴数据即可。',
  }),
  'LOG-BOOT-002': (log) => ({
    title: '深度学习：已完成并生成新版本',
    whatHappened: s(log.description) || '深度学习已完成。',
    impact: '可能提升后续预测表现；学习期间部分操作会被锁定。',
    suggestion: '完成后按提示开始新靴即可。',
  }),
  'LOG-BOOT-003': (log) => ({
    title: '深度学习：失败',
    whatHappened: s(log.description) || '深度学习失败。',
    impact: '本次学习结果不会生效，可能需要重新执行。',
    suggestion: '建议检查接口配置/网络后重试，或联系维护人员。',
  }),
  'LOG-BOOT-004': (log) => ({
    title: '深度学习：已取消',
    whatHappened: s(log.description) || '深度学习被取消。',
    impact: '本次学习不会生成新版本。',
    suggestion: '如需学习可再次启动；也可直接开始新靴。',
  }),
  'LOG-VAL-001': (log) => ({
    title: '参数校验失败：上传数据不合法',
    whatHappened: s(log.description) || '上传参数不符合要求。',
    impact: '本次上传不会生效。',
    suggestion: '检查上传局号是否从1开始且连续，开奖结果是否为庄/闲/和。',
  }),
  'LOG-VAL-002': (log) => ({
    title: '参数校验失败：开奖数据不合法',
    whatHappened: s(log.description) || '开奖参数不符合要求。',
    impact: '本次开奖不会生效。',
    suggestion: '检查局号与结果是否正确后重试。',
  }),
  'LOG-VAL-003': (log) => ({
    title: 'AI分析失败：缺少历史数据',
    whatHappened: s(log.description) || '当前靴没有历史数据，无法分析。',
    impact: '无法给出预测/下注建议。',
    suggestion: '先上传/录入至少1局开奖记录后再分析。',
  }),
  'LOG-MNL-002': (log) => ({
    title: `开奖：第${log.game_number ?? '-'}局结果已录入`,
    whatHappened: s(log.description) || '已录入开奖结果。',
    impact: '会触发结算并更新余额与统计。',
    suggestion: '无需操作，等待结算完成即可。',
  }),
  'LOG-MDL-001': (log) => ({
    title: `AI分析：第${log.game_number ?? '-'}局已完成预测`,
    whatHappened: s(log.description) || 'AI已完成本局预测。',
    impact: '会生成下一步下注方向/金额建议。',
    suggestion: '无需操作，等待系统自动下注或手动确认。',
  }),
  'LOG-MDL-002': (log) => ({
    title: 'AI分析异常：本次输出已回退为安全结果',
    whatHappened: s(log.description) || 'AI分析发生异常。',
    impact: '可能会使用保守/默认策略继续流程。',
    suggestion: '如频繁出现，建议检查AI接口配置或切换到规则模式。',
  }),
  'LOG-MDL-003': (log) => ({
    title: 'AI分析：综合结论已生成',
    whatHappened: s(log.description) || '综合模型输出已生成。',
    impact: '用于最终下注决策。',
    suggestion: '无需操作。',
  }),
  'LOG-BET-001': (log) => ({
    title: `下注：第${log.game_number ?? '-'}局已下注`,
    whatHappened: s(log.description) || '已执行下注。',
    impact: '余额已扣除对应下注金额。',
    suggestion: '等待开奖即可。',
  }),
  'LOG-BET-ERR': (log) => ({
    title: `下注失败：${s(log.event_result) || '失败'}`,
    whatHappened: s(log.description) || '下注失败。',
    impact: '本局可能没有有效下注记录。',
    suggestion: '检查余额是否足够，或降低下注金额后重试。',
  }),
  'LOG-AI-001': (log) => ({
    title: 'AI学习：已生成学习记录',
    whatHappened: s(log.description) || 'AI学习写入了记录。',
    impact: '用于后续策略优化。',
    suggestion: '无需操作。',
  }),
  'LOG-AI-002': (log) => ({
    title: 'AI学习：已切换/生成模型版本',
    whatHappened: s(log.description) || '模型版本已更新。',
    impact: '后续推理会使用新版本。',
    suggestion: '可在管理员页面查看版本信息。',
  }),
  'LOG-AI-003': (log) => ({
    title: 'AI学习：学习过程已记录',
    whatHappened: s(log.description) || 'AI学习过程已记录。',
    impact: '用于追踪学习效果。',
    suggestion: '无需操作。',
  }),
  'LOG-ERR-001': (log) => ({
    title: '系统异常：结算过程出现问题',
    whatHappened: s(log.description) || '结算异常。',
    impact: '可能导致余额/下注记录不一致。',
    suggestion: '建议点击“一键修复/刷新页面”，如仍异常请截图反馈。',
  }),
  'LOG-ERR-009': (log) => ({
    title: '系统异常：AI学习/任务执行错误',
    whatHappened: s(log.description) || '任务执行错误。',
    impact: '可能影响学习结果或后续分析。',
    suggestion: '建议检查接口配置与网络，必要时联系维护人员。',
  }),
  'LOG-ASYNC-001': (log) => ({
    title: '后台任务异常',
    whatHappened: s(log.description) || '后台任务执行发生异常。',
    impact: '可能影响分析/学习等后台功能。',
    suggestion: '建议联系维护人员查看后端日志。',
  }),
  'LOG-MAINT-RET': (log) => ({
    title: '系统维护：已执行数据清理',
    whatHappened: s(log.description) || '已执行日志/历史数据清理。',
    impact: '减少数据膨胀，提升系统稳定性。',
    suggestion: '无需操作。',
  }),
  'UT-RET': (log) => ({
    title: '系统维护：内部测试记录',
    whatHappened: s(log.description) || '内部测试产生的记录。',
    impact: '不影响正常使用。',
    suggestion: '无需处理。',
  }),
};

const inferGeneric = (log: LogEntry): Omit<HumanLog, 'fieldsCn'> => {
  const code = s(log.event_code);
  const type = s(log.event_type) || '系统事件';
  const result = s(log.event_result) || '已记录';
  const desc = s(log.description);

  const fail = result === '失败' || isErrorPriority(s(log.priority));

  const byPrefix = (p: string): { impact: string; suggestion: string } | null => {
    if (p === 'LOG-MDL') return { impact: '与AI分析相关。', suggestion: fail ? '可尝试刷新或切换规则模式。' : '无需操作。' };
    if (p === 'LOG-BET') return { impact: '与下注相关。', suggestion: fail ? '检查余额/网络后重试。' : '等待开奖即可。' };
    if (p === 'LOG-BOOT') return { impact: '与靴/学习流程相关。', suggestion: fail ? '检查学习配置与网络后重试。' : '按提示继续流程。' };
    if (p === 'LOG-RECOVER') return { impact: '系统在做自动修复/恢复。', suggestion: '一般无需处理。' };
    if (p === 'LOG-WDG') return { impact: '系统守护进程的监控/告警。', suggestion: '一般无需处理；如频繁出现可反馈排查。' };
    if (p === 'LOG-VAL') return { impact: '输入参数不符合要求，本次操作不会生效。', suggestion: '按提示修正输入后重试。' };
    if (p === 'LOG-ERR') return { impact: '系统异常，可能影响流程。', suggestion: '建议刷新页面或点击系统修复；如持续出现请截图反馈。' };
    if (p === 'LOG-SYS') return { impact: '系统状态/配置发生变化。', suggestion: '如非你主动操作，建议检查管理员操作记录。' };
    return null;
  };

  const prefix = code.includes('-') ? code.split('-').slice(0, 2).join('-') : code;
  const inferred = byPrefix(prefix);

  const title = fail ? `${type}：出现异常` : `${type}：${result}`;
  const what = desc || `系统记录了一条 ${type} 日志。`;
  const impact = inferred?.impact || (fail ? '可能影响当前流程，请留意系统状态。' : '一般不影响使用。');
  const suggestion = inferred?.suggestion || (fail ? '建议刷新页面后重试；如持续出现请截图反馈。' : '无需处理。');

  return { title, whatHappened: what, impact, suggestion };
};

export const humanizeLog = (log: LogEntry): HumanLog => {
  const code = s(log.event_code);
  const r = rule[code];
  const base = r ? r(log) : inferGeneric(log);
  return {
    ...base,
    fieldsCn: baseFields(log),
  };
};

export const toHumanCopyText = (log: LogEntry): string => {
  const h = humanizeLog(log);
  const lines: string[] = [];
  lines.push(`【${h.title}】`);
  lines.push('');
  lines.push(`发生了什么：${h.whatHappened}`);
  lines.push(`有什么影响：${h.impact}`);
  lines.push(`建议怎么做：${h.suggestion}`);
  lines.push('');
  lines.push('关键信息：');
  for (const f of h.fieldsCn) {
    lines.push(`- ${f.label}：${f.value}`);
  }
  return lines.join('\n');
};

