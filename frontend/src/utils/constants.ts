/**
 * 智能分析文案模板 - 百家乐分析预测系统
 * 严格遵循20号文档定义的模板规范
 */

// ====== 三档文案差异模板 ======

export const TIER_TEMPLATES = {
  conservative: {
    label: '保守档',
    prompt: {
      trigger: '风险上升，已切换保守策略，先稳住再提升。',
      status: '当前为保守档，下注更稳，波动更小。',
      explain: '因为近期出现连续失准或回撤抬升，所以本局采用保守档。',
      recover: '风险回落后将自动恢复到标准档。',
    },
    combined: '因为{主要证据成立}+{反向风险仍在}，所以按保守策略下局预测{direction}',
  },
  standard: {
    label: '标准档',
    prompt: {
      trigger: '策略恢复平衡，已切换标准策略。',
      status: '当前为标准档，风险与收益保持均衡。',
      explain: '因为当前证据稳定且冲突可控，所以本局采用标准档。',
      upgrade: '若风险上升会降到保守档，若同向增强可升到进取档。',
    },
    combined: '因为{主要证据成立}+{冲突可控}，所以按标准策略下局预测{direction}',
  },
  aggressive: {
    label: '进取档',
    prompt: {
      trigger: '信号增强，已切换进取策略，请关注波动风险。',
      status: '当前为进取档，机会更高，波动也更大。',
      explain: '因为多路同向放大且连续命中，所以本局采用进取档。',
      risk: '若出现反向扰动将自动降回标准档或保守档。',
    },
    combined: '因为{主要证据强化}+{多路同向放大}，所以按进取策略下局预测{direction}',
  },
} as const;

// ====== 异常提示词 ======

export const ERROR_PROMPTS = {
  inconsistency: '分析结论与顶部预测不一致，系统正在自动修正。',
  missing_factor: '智能分析要点不完整，系统正在补全并重算。',
  timeout: '智能分析刷新超时，系统已触发重算，请稍候。',
} as const;

// ====== 空状态文案 ======

export const EMPTY_STATES = {
  noData: {
    main: '暂无数据，系统正在等待开奖。',
    guide: '请保持页面开启，检测到新局后将自动开始分析。',
    sub: '若长时间无变化，可检查网络或重新选桌。',
  },
  waitingResult: {
    main: '等待开奖中',
    guide: '当前局尚未结束，系统会在开奖后自动刷新预测。',
    sub: '你可以先查看上一局智能分析与实盘日志。',
  },
  networkError: {
    main: '网络波动，正在自动重试。',
    guide: '系统不会中断当前流程，恢复后将自动补齐数据。',
    sub: '若持续波动，请检查网络后点击"继续运行"。',
  },
  aiLearning: {
    main: 'AI学习进行中，部分操作已锁定。',
    guide: '学习完成后将自动解锁，并显示学习总结与版本信息。',
    sub: '你可继续查看日志、开奖记录和当前局状态。',
  },
  shuffleWait: {
    main: '当前处于洗牌等待。',
    guide: '系统每10分钟自动探测一次，检测到新局将自动恢复运行。',
    sub: '无需手动操作，可保持页面待机。',
  },
} as const;

// ====== 按钮文案 ======

export const BUTTON_TEXTS = {
  startSuccess: {
    primary: '系统已启动',
    secondary: '当前桌台连接正常，正在进入实时分析。',
    log: '查看启动日志',
  },
  strategySwitch: {
    conservative: '切到保守档',
    standard: '切到标准档',
    aggressive: '切到进取档',
    switchSuccess: '策略已切换，当前为{tier}档。',
    switchFail: '策略切换失败，系统正在自动重试。',
  },
  errorRecovery: {
    primary: '一键恢复',
    secondary: '继续观察',
    recovering: '系统正在恢复，请稍候。',
    success: '恢复完成，已回到正常分析流程。',
    fail: '恢复失败，建议重新选桌后再启动。',
  },
  recalc: {
    primary: '已完成重算',
    detail: '查看重算明细',
    success: '智能分析已重算完成，结果已同步更新。',
    risk: '若再次异常，系统将自动触发下一轮重算。',
  },
} as const;

// ====== 弹窗文案 ======

export const DIALOG_TEXTS = {
  stopConfirm: {
    title: '确认停止系统',
    content: '停止后将暂停实时分析，是否继续？',
    ok: '确认停止',
    cancel: '继续运行',
  },
  recalcConfirm: {
    title: '确认重新计算',
    content: '将基于当前局数据重新计算，是否继续？',
    ok: '开始重算',
    cancel: '暂不重算',
  },
  riskWarning: {
    title: '风险提示',
    aggressiveContent: '当前为进取档，命中机会提升，但波动也更大，请留意回撤。',
    volatilityContent: '近期结果波动加大，系统可能自动降档以控制风险。',
    ok: '我已了解',
  },
  recoveryFail: {
    title: '恢复失败',
    content: '本次自动恢复未成功，建议点击"重新选桌"后再启动。',
    primary: '重新选桌',
    secondary: '继续观察',
    supplement: '系统已保留当前日志，便于后续排查。',
  },
} as const;

// ====== 日志模板 ======

export const LOG_TEMPLATES = {
  adaptiveCalc: (gameNumber: number, tier: string, amount: number) =>
    `第${gameNumber}局自适应计算完成，档位${tier}，建议下注${amount}`,
  betExecute: (gameNumber: number, direction: string, amount: number, balance: number) =>
    `第${gameNumber}局下注已执行，方向${direction}，金额${amount}，当前余额${balance}`,
  tierSwitch: (gameNumber: number, tier: string, reason: string) =>
    `第${gameNumber}局档位切换为${tier}，原因：${reason}`,
  consecutiveError: (count: number) =>
    `连续${count}局预测错误，已切换保守金额策略`,
  hitRecovery: (amount: number) =>
    `命中恢复，下注金额按梯度回升至${amount}`,
  newGame: (gameNumber: number) =>
    `检测到新局号${gameNumber}，开奖数据采集完成`,
  analysisDone: (gameNumber: number, direction: string, confidence: number) =>
    `第${gameNumber}局分析完成，预测${direction}，置信度${(confidence * 100).toFixed(0)}%`,
  settleDone: (gameNumber: number, result: string, profitLoss: number) =>
    `第${gameNumber}局结算完成，结果${result}，盈亏${profitLoss > 0 ? '+' : ''}${profitLoss}`,
  timeoutRefund: (gameNumber: number, amount: number) =>
    `第${gameNumber}局超过5分钟未开奖，已自动退回${amount}`,
  workflowTimeout: (gameNumber: number, step: string) =>
    `第${gameNumber}局工作流超时150秒，判定异常，异常环节${step}，已执行自动暂停`,
};

// ====== 状态文案 ======

export const STATUS_TEXTS: Record<string, { color: string; text: string }> = {
  running: { color: '#52c41a', text: '运行中' },
  waiting: { color: '#1890ff', text: '等待开奖' },
  strategy_review: { color: '#faad14', text: '策略重评估中' },
  error: { color: '#ff4d4f', text: '异常处理中' },
  stopped: { color: '#d9d9d9', text: '已停止' },
  shuffle_wait: { color: '#8c8c8c', text: '洗牌等待' },
};

// ====== 日志优先级颜色 ======

export const PRIORITY_COLORS: Record<string, string> = {
  P0: '#ff4d4f',  // 致命-红
  P1: '#ff4d4f',  // 严重-红
  P2: '#faad14',  // 警告-橙
  P3: '#1890ff',  // 信息-蓝
};

// ====== 日志分类 ======

export const LOG_CATEGORIES = [
  { label: '全部', value: '' },
  { label: '系统状态', value: '系统状态' },
  { label: '操作记录', value: '操作记录' },
  { label: '工作流事件', value: '工作流事件' },
  { label: '资金事件', value: '资金事件' },
];

// ====== 下注状态颜色 ======

export const BET_STATUS_COLORS: Record<string, string> = {
  '待开奖': '#1890ff',
  '已结算': '#52c41a',
  '异常退回': '#faad14',
  '数据异常': '#ff4d4f',
};
