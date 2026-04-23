/**
 * 智能分析文案模板 - 百家乐分析预测系统（手动模式）
 * 严格遵循20号文档定义的模板规范
 * 已适配 React Native (主要复用 Web 版的文案和颜色)
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
    main: '暂无数据，请先上传开奖记录。',
    guide: '点击"上传数据"按钮，手动输入开奖结果开始分析。',
    sub: '支持1-72局批量上传，上传后自动计算五路走势图。',
  },
  waitingResult: {
    main: '等待开奖中',
    guide: '当前局尚未结束，请在开奖后输入结果完成结算。',
    sub: '你可以先查看当前AI分析和五路走势图。',
  },
  networkError: {
    main: '网络波动，正在自动重试。',
    guide: '系统不会中断当前流程，恢复后将自动补齐数据。',
    sub: '若持续波动，请检查网络后刷新页面。',
  },
  aiLearning: {
    main: 'AI学习进行中，部分操作已锁定。',
    guide: '学习完成后将自动解锁，并显示学习总结与版本信息。',
    sub: '你可继续查看日志、开奖记录和当前局状态。',
  },
} as const;

// ====== 按钮文案 ======

export const BUTTON_TEXTS = {
  startSuccess: {
    primary: '系统已就绪',
    secondary: '当前桌台数据加载完成，可以开始分析。',
    log: '查看操作日志',
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
    fail: '恢复失败，建议重新加载页面。',
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
    title: '确认重置数据',
    content: '重置后将清空当前桌台的所有数据，是否继续？',
    ok: '确认重置',
    cancel: '取消',
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
    content: '本次自动恢复未成功，建议重新加载页面后再试。',
    primary: '重新加载',
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
  uploadComplete: (count: number) =>
    `上传完成，新增${count}局开奖记录`,
  analysisDone: (gameNumber: number, direction: string, confidence: number) =>
    `第${gameNumber}局分析完成，预测${direction}，置信度${(confidence * 100).toFixed(0)}%`,
  settleDone: (gameNumber: number, result: string, profitLoss: number) =>
    `第${gameNumber}局结算完成，结果${result}，盈亏${profitLoss > 0 ? '+' : ''}${profitLoss}`,
  manualInput: (gameNumber: number, result: string) =>
    `第${gameNumber}局手动输入开奖结果：${result}`,
} as const;

// ====== 状态文案 ======

export const STATUS_TEXTS: Record<string, { color: string; text: string }> = {
  running: { color: '#52c41a', text: '运行中' },
  waiting: { color: '#1890ff', text: '等待开奖' },
  strategy_review: { color: '#faad14', text: '策略重评估中' },
  error: { color: '#ff4d4f', text: '异常处理中' },
  stopped: { color: '#d9d9d9', text: '已停止' },
  ai_analyzing: { color: '#722ed1', text: 'AI分析中' },
  pending_bet: { color: '#faad14', text: '等待下注' },
  pending_reveal: { color: '#1890ff', text: '等待开奖' },
  idle: { color: '#8c8c8c', text: '空闲' },
};

// ====== 手动模式状态文案 ======

export const MANUAL_STATUS_TEXTS = {
  waitingBet: (gameNumber: number) => `等待第${gameNumber}局下注`,
  waitingReveal: (gameNumber: number) => `等待第${gameNumber}局开奖`,
  aiAnalyzing: (gameNumber: number) => `AI正在分析第${gameNumber}局`,
  betPlaced: (gameNumber: number, direction: string, amount: number) =>
    `第${gameNumber}局已下注${direction} ${amount}，等待开奖`,
  revealPrompt: (gameNumber: number) => `请输入第${gameNumber}局开奖结果`,
  settlementDone: (gameNumber: number, result: string, profit: number) =>
    `第${gameNumber}局结算完成，结果${result}，${profit >= 0 ? '盈利' : '亏损'}${Math.abs(profit)}`,
} as const;

// ====== 开奖按钮文案 ======

export const REVEAL_BUTTON_TEXTS = {
  idle: '开奖',
  waiting: '等待开奖中...',
  confirm: '确认开奖',
  processing: '结算中...',
} as const;

// ====== 下注选项 ======

export const BET_DIRECTIONS = [
  { value: '庄', label: '庄', color: '#ff4d4f', bgColor: 'rgba(255,77,79,0.12)' },
  { value: '闲', label: '闲', color: '#1890ff', bgColor: 'rgba(24,144,255,0.12)' },
  { value: '和', label: '和', color: '#52c41a', bgColor: 'rgba(82,196,26,0.12)' },
] as const;

// ====== 日志优先级颜色 ======

export const PRIORITY_COLORS: Record<string, string> = {
  P0: '#ff4d4f',  // 致命-红
  P1: '#ff4d4f',  // 严重-红
  P2: '#faad14',  // 警告-橙
  P3: '#1890ff',  // 信息-蓝
};

// ====== 日志分类（手动模式） ======

export const LOG_CATEGORIES = [
  { label: '全部', value: '' },
  { label: '系统状态', value: '系统状态' },
  { label: '操作记录', value: '操作记录' },
  { label: 'AI分析', value: 'AI分析' },
  { label: '资金事件', value: '资金事件' },
  { label: '开奖记录', value: '开奖记录' },
];

// ====== 下注状态颜色 ======

export const BET_STATUS_COLORS: Record<string, string> = {
  '待开奖': '#1890ff',
  '已结算': '#52c41a',
  '异常退回': '#faad14',
  '数据异常': '#ff4d4f',
};

// ====== 游戏结果颜色 ======

export const RESULT_COLORS: Record<string, string> = {
  '庄': '#ff4d4f',
  '闲': '#1890ff',
  '和': '#52c41a',
  '': 'rgba(255,255,255,0.15)',
};

export const RESULT_BG: Record<string, string> = {
  '庄': 'rgba(255,77,79,0.12)',
  '闲': 'rgba(24,144,255,0.12)',
  '和': 'rgba(82,196,26,0.12)',
  '': 'rgba(255,255,255,0.04)',
};

// ====== 游戏常量 ======

/** 每靴最大局数 */
export const MAX_GAMES_PER_BOOT = 72;

/** 默认下注金额 */
export const DEFAULT_BET_AMOUNT = 100;

/** 最小下注金额 */
export const MIN_BET_AMOUNT = 10;

/** 最大下注金额 */
export const MAX_BET_AMOUNT = 10000;
