/**
 * 智能工作流状态管理 Hook
 * 管理工作流状态、倒计时、自动检测漏操作等功能
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { App } from 'antd';

// ====== 类型定义 ======

export type WorkflowStatus = 
  | 'idle'           // 空闲状态
  | 'waiting_bet'    // 等待下注
  | 'bet_placed'     // 已下注
  | 'waiting_result' // 等待开奖
  | 'revealing'      // 正在开奖
  | 'settling';      // 正在结算

export interface WorkflowState {
  status: WorkflowStatus;
  currentGameNumber: number;
  lastActionTime: number | null;
  nextActionDeadline: number | null;
  pendingBet: {
    direction: string;
    amount: number;
    tier: string;
  } | null;
}

export interface WorkflowTimer {
  elapsed: number;      // 已过去的时间（秒）
  remaining: number;    // 剩余时间（秒）
  isOverdue: boolean;   // 是否超时
  progress: number;     // 进度百分比（0-100）
}

interface UseWorkflowStateOptions {
  systemStatus: string;
  pendingBet: {
    direction: string;
    amount: number;
    tier: string;
    game_number: number;
    time: string | null;
  } | null;
  currentGameNumber: number;
}

interface UseWorkflowStateReturn {
  // 工作流状态
  workflowState: WorkflowState;
  workflowStatus: WorkflowStatus;
  
  // 计时器
  timer: WorkflowTimer;
  formattedTime: string;
  
  // 状态转换
  startBetting: () => void;
  placeBet: (direction: string, amount: number, tier: string) => void;
  waitForResult: () => void;
  revealResult: () => void;
  completeSettlement: () => void;
  resetWorkflow: () => void;
  
  // 智能检测
  isActionOverdue: boolean;
  overdueMessage: string | null;
  suggestedAction: string | null;
}

// 工作流超时配置（秒）
const TIMEOUT_CONFIG: Record<WorkflowStatus, number> = {
  idle: 0,
  waiting_bet: 120,     // 等待下注：2分钟
  bet_placed: 30,       // 已下注：30秒确认
  waiting_result: 180,  // 等待开奖：3分钟
  revealing: 10,        // 开奖中：10秒
  settling: 10,         // 结算中：10秒
};

// 提醒阈值（秒）
const WARNING_THRESHOLD = 30;

/**
 * 智能工作流状态管理 Hook
 */
export const useWorkflowState = (options: UseWorkflowStateOptions): UseWorkflowStateReturn => {
  const { systemStatus, pendingBet, currentGameNumber } = options;
  const { message } = App.useApp();
  
  // ====== 状态 ======
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    status: 'idle',
    currentGameNumber: 0,
    lastActionTime: null,
    nextActionDeadline: null,
    pendingBet: null,
  });
  
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // ====== 根据系统状态自动推断工作流状态 ======

  useEffect(() => {
    
    let newStatus: WorkflowStatus = 'idle';

    switch (systemStatus) {
      case '分析完成':
        newStatus = pendingBet ? 'bet_placed' : 'waiting_bet';
        break;
      case '等待开奖':
        newStatus = 'waiting_result';
        break;
      case '正在开奖':
        newStatus = 'revealing';
        break;
      case '正在结算':
        newStatus = 'settling';
        break;
      default:
        newStatus = 'idle';
    }

    // 使用setTimeout避免同步setState
    const timer = setTimeout(() => {
      setWorkflowState(prev => {
        // 状态变化时更新时间戳
        if (prev.status !== newStatus) {
          const now = Date.now();
          const timeout = TIMEOUT_CONFIG[newStatus];
          return {
            ...prev,
            status: newStatus,
            currentGameNumber,
            lastActionTime: now,
            nextActionDeadline: timeout > 0 ? now + timeout * 1000 : null,
            pendingBet: pendingBet ? {
              direction: pendingBet.direction,
              amount: pendingBet.amount,
              tier: pendingBet.tier,
            } : null,
          };
        }
        return prev;
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [systemStatus, pendingBet, currentGameNumber]);
  
  // ====== 计时器 ======

  useEffect(() => {
    // 清除旧计时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // 使用setTimeout避免同步setState
    const resetTimer = setTimeout(() => {
      setElapsed(0);
    }, 0);

    // 如果状态有超时限制，启动计时器
    if (workflowState.status !== 'idle' && TIMEOUT_CONFIG[workflowState.status] > 0) {
      timerRef.current = setInterval(() => {
        setElapsed(e => {
          const newElapsed = e + 1;
          const timeout = TIMEOUT_CONFIG[workflowState.status];

          // 到达警告阈值时提醒
          if (newElapsed === timeout - WARNING_THRESHOLD) {
            const remaining = WARNING_THRESHOLD;
            message.warning(`${getStatusDisplayName(workflowState.status)}还剩${remaining}秒，请尽快操作`);
          }

          // 超时时提醒
          if (newElapsed >= timeout) {
            message.error(`${getStatusDisplayName(workflowState.status)}已超时，请检查操作状态`);
          }

          return newElapsed;
        });
      }, 1000);
    }

    return () => {
      clearTimeout(resetTimer);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [workflowState.status, message]);
  
  // ====== 计算计时器显示 ======
  
  const timeout = TIMEOUT_CONFIG[workflowState.status];
  const remaining = Math.max(0, timeout - elapsed);
  const isOverdue = elapsed > timeout && timeout > 0;
  const progress = timeout > 0 ? Math.min(100, (elapsed / timeout) * 100) : 0;
  
  const timer: WorkflowTimer = {
    elapsed,
    remaining,
    isOverdue,
    progress,
  };
  
  // 格式化时间显示
  const formattedTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);
  
  // ====== 状态转换方法 ======
  
  const startBetting = useCallback(() => {
    const now = Date.now();
    setWorkflowState({
      status: 'waiting_bet',
      currentGameNumber,
      lastActionTime: now,
      nextActionDeadline: now + TIMEOUT_CONFIG.waiting_bet * 1000,
      pendingBet: null,
    });
    setElapsed(0);
  }, [currentGameNumber]);
  
  const placeBet = useCallback((direction: string, amount: number, tier: string) => {
    const now = Date.now();
    setWorkflowState(prev => ({
      ...prev,
      status: 'bet_placed',
      lastActionTime: now,
      nextActionDeadline: now + TIMEOUT_CONFIG.bet_placed * 1000,
      pendingBet: { direction, amount, tier },
    }));
    setElapsed(0);
  }, []);
  
  const waitForResult = useCallback(() => {
    const now = Date.now();
    setWorkflowState(prev => ({
      ...prev,
      status: 'waiting_result',
      lastActionTime: now,
      nextActionDeadline: now + TIMEOUT_CONFIG.waiting_result * 1000,
    }));
    setElapsed(0);
  }, []);
  
  const revealResult = useCallback(() => {
    const now = Date.now();
    setWorkflowState(prev => ({
      ...prev,
      status: 'revealing',
      lastActionTime: now,
      nextActionDeadline: now + TIMEOUT_CONFIG.revealing * 1000,
    }));
    setElapsed(0);
  }, []);
  
  const resetWorkflow = useCallback(() => {
    setWorkflowState({
      status: 'idle',
      currentGameNumber: 0,
      lastActionTime: null,
      nextActionDeadline: null,
      pendingBet: null,
    });
    setElapsed(0);
  }, []);

  // 使用ref存储resetWorkflow函数，避免循环依赖
  const resetWorkflowRef = useRef(resetWorkflow);

  // 使用useEffect更新ref，避免在渲染期间修改
  useEffect(() => {
    resetWorkflowRef.current = resetWorkflow;
  }, [resetWorkflow]);

  const settlingTimerRef = useRef<number | ReturnType<typeof setTimeout> | null>(null);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (settlingTimerRef.current) {
        clearTimeout(settlingTimerRef.current);
      }
    };
  }, []);

  const completeSettlement = useCallback(() => {
    const now = Date.now();
    setWorkflowState(prev => ({
      ...prev,
      status: 'settling',
      lastActionTime: now,
      nextActionDeadline: now + TIMEOUT_CONFIG.settling * 1000,
    }));
    setElapsed(0);

    // 清除可能已存在的旧定时器
    if (settlingTimerRef.current) {
      clearTimeout(settlingTimerRef.current);
    }

    // 结算完成后自动回到空闲状态，并保存定时器以防内存泄漏
    settlingTimerRef.current = setTimeout(() => {
      if (resetWorkflowRef.current) {
        resetWorkflowRef.current();
      }
    }, TIMEOUT_CONFIG.settling * 1000);
  }, []);
  
  // ====== 智能检测 ======
  
  const isActionOverdue = isOverdue;
  
  const overdueMessage = isOverdue 
    ? `${getStatusDisplayName(workflowState.status)}已超时${formatDuration(elapsed - timeout)}，请检查操作状态`
    : null;
  
  const suggestedAction = useCallback((): string | null => {
    switch (workflowState.status) {
      case 'waiting_bet':
        return pendingBet ? '等待系统确认下注...' : '请根据AI分析结果进行下注';
      case 'bet_placed':
        return '下注已提交，等待开奖结果';
      case 'waiting_result':
        return '请等待开奖结果公布，然后点击开奖按钮';
      case 'revealing':
        return '正在开奖中，请稍候...';
      case 'settling':
        return '正在结算，请稍候...';
      default:
        return null;
    }
  }, [workflowState.status, pendingBet])();
  
  return {
    workflowState,
    workflowStatus: workflowState.status,
    timer,
    formattedTime: formattedTime(remaining),
    startBetting,
    placeBet,
    waitForResult,
    revealResult,
    completeSettlement,
    resetWorkflow,
    isActionOverdue,
    overdueMessage,
    suggestedAction,
  };
};

// 辅助函数：获取状态显示名称
function getStatusDisplayName(status: WorkflowStatus): string {
  const names: Record<WorkflowStatus, string> = {
    idle: '空闲',
    waiting_bet: '分析完成',
    bet_placed: '已下注',
    waiting_result: '等待开奖',
    revealing: '开奖中',
    settling: '结算中',
  };
  return names[status] || status;
}

// 辅助函数：格式化持续时间
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`;
}

export default useWorkflowState;
