/**
 * 智能检测系统 Hook
 * 提供数据完整性检测、异常模式检测、智能风险提示等功能
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { message } from 'antd';
import type { GameRecord, BetRecord, SystemState } from './useGameState';

// ====== 类型定义 ======

export interface DataIntegrityIssue {
  type: 'missing' | 'duplicate' | 'jump' | 'format';
  message: string;
  gameNumber?: number;
  severity: 'warning' | 'error';
}

export interface AbnormalPattern {
  type: 'consecutive' | 'win_rate_drop' | 'large_bet' | 'balance_low';
  message: string;
  details: string;
  severity: 'info' | 'warning' | 'danger';
  timestamp: number;
}

export interface SmartAlert {
  id: string;
  type: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  message: string;
  autoClose?: boolean;
  duration?: number;
}

export interface BettingAdvice {
  canBet: boolean;
  reason: string;
  confidence: number;
  suggestedAmount: number | null;
  riskLevel: 'low' | 'medium' | 'high';
}

interface UseSmartDetectionOptions {
  games: GameRecord[];
  bets: BetRecord[];
  systemState: SystemState | null;
  
}

interface UseSmartDetectionReturn {
  // 数据完整性
  integrityIssues: DataIntegrityIssue[];
  checkDataIntegrity: () => DataIntegrityIssue[];
  hasCriticalIssues: boolean;
  
  // 异常模式检测
  abnormalPatterns: AbnormalPattern[];
  detectAbnormalPatterns: () => AbnormalPattern[];
  consecutiveResults: { result: string; count: number } | null;
  recentWinRate: number;
  
  // 智能下注建议
  bettingAdvice: BettingAdvice;
  
  // 智能提醒
  alerts: SmartAlert[];
  addAlert: (alert: Omit<SmartAlert, 'id'>) => void;
  removeAlert: (id: string) => void;
  clearAlerts: () => void;
  
  // 数据同步状态
  lastSyncTime: number | null;
  isDataStale: boolean;
  markSynced: () => void;
}

// 生成唯一ID
const generateId = () => Math.random().toString(36).substring(2, 9);

/**
 * 智能检测系统 Hook
 */
export const useSmartDetection = (options: UseSmartDetectionOptions): UseSmartDetectionReturn => {
    const { games, bets, systemState,  } = options;
  
  // ====== 状态 ======
  const [integrityIssues, setIntegrityIssues] = useState<DataIntegrityIssue[]>([]);
  const [abnormalPatterns, setAbnormalPatterns] = useState<AbnormalPattern[]>([]);
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  
  // ====== 数据完整性检测 ======
  
  const checkDataIntegrity = useCallback((): DataIntegrityIssue[] => {
    const issues: DataIntegrityIssue[] = [];
    
    if (games.length === 0) return issues;
    
    // 1. 检测局号是否连续
    const sortedGames = [...games].sort((a, b) => a.game_number - b.game_number);
    for (let i = 1; i < sortedGames.length; i++) {
      const prev = sortedGames[i - 1].game_number;
      const curr = sortedGames[i].game_number;
      if (curr !== prev + 1) {
        issues.push({
          type: 'jump',
          message: `局号不连续：从第${prev}局跳到第${curr}局，缺失第${prev + 1}局`,
          gameNumber: curr,
          severity: 'error',
        });
      }
    }
    
    // 2. 检测重复局号
    const gameNumbers = sortedGames.map(g => g.game_number);
    const duplicates = gameNumbers.filter((item, index) => gameNumbers.indexOf(item) !== index);
    if (duplicates.length > 0) {
      const uniqueDuplicates = [...new Set(duplicates)];
      uniqueDuplicates.forEach(num => {
        issues.push({
          type: 'duplicate',
          message: `发现重复局号：第${num}局出现了多次`,
          gameNumber: num,
          severity: 'error',
        });
      });
    }
    
    // 3. 检测结果格式
    const validResults = ['庄', '闲', '和'];
    sortedGames.forEach(game => {
      if (!validResults.includes(game.result)) {
        issues.push({
          type: 'format',
          message: `第${game.game_number}局结果格式错误："${game.result}"`,
          gameNumber: game.game_number,
          severity: 'error',
        });
      }
    });
    
    // 4. 检测缺失数据（如果局号从大于1开始且只有部分数据被加载）
    // 注意：如果只是分页查询，首个数据的局号大于1是正常的，因此不应该在这里报缺失警告
    // 只有当查询的是全部数据（或第一页）且最小局号不等于1时才报警
    // 在目前的场景中，为了避免误报，我们将这个检查弱化或移除，因为上传的数据可能就是残缺的或者分页的
    /* 
    if (sortedGames.length > 0 && sortedGames[0].game_number > 1) {
      issues.push({
        type: 'missing',
        message: `数据不完整：从第${sortedGames[0].game_number}局开始，可能缺失前面的数据`,
        gameNumber: sortedGames[0].game_number,
        severity: 'warning',
      });
    }
    */
    
    setIntegrityIssues(issues);
    return issues;
  }, [games]);
  
  // 自动检测数据完整性
  useEffect(() => {
    if (games.length > 0) {
      // 使用setTimeout避免同步调用setState
      const timer = setTimeout(() => {
        checkDataIntegrity();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [games, checkDataIntegrity]);
  
  const hasCriticalIssues = useMemo(() => {
    return integrityIssues.some(issue => issue.severity === 'error');
  }, [integrityIssues]);
  
  // ====== 异常模式检测 ======
  
  // 计算连续结果
  const consecutiveResults = useMemo(() => {
    if (games.length === 0) return null;
    
    const sortedGames = [...games].sort((a, b) => a.game_number - b.game_number);
    const lastResult = sortedGames[sortedGames.length - 1].result;
    
    let count = 0;
    for (let i = sortedGames.length - 1; i >= 0; i--) {
      if (sortedGames[i].result === lastResult) {
        count++;
      } else {
        break;
      }
    }
    
    return count >= 3 ? { result: lastResult, count } : null;
  }, [games]);
  
  // 计算最近胜率
  const recentWinRate = useMemo(() => {
    if (bets.length === 0) return 0;
    
    const sortedBets = [...bets].sort((a, b) => {
      const timeA = a.bet_time ? new Date(a.bet_time).getTime() : 0;
      const timeB = b.bet_time ? new Date(b.bet_time).getTime() : 0;
      return timeB - timeA;
    });
    
    const recentBets = sortedBets.slice(0, 10);
    const wonBets = recentBets.filter(bet => bet.profit_loss && bet.profit_loss > 0);
    
    return recentBets.length > 0 ? (wonBets.length / recentBets.length) * 100 : 0;
  }, [bets]);
  
  const detectAbnormalPatterns = useCallback((): AbnormalPattern[] => {
    const patterns: AbnormalPattern[] = [];
    
    // 1. 检测连续结果
    if (consecutiveResults && consecutiveResults.count >= 5) {
      patterns.push({
        type: 'consecutive',
        message: `注意：连续${consecutiveResults.count}局出现${consecutiveResults.result}`,
        details: '历史数据显示连续同结果后反转概率较高，建议谨慎下注',
        severity: consecutiveResults.count >= 7 ? 'danger' : 'warning',
        timestamp: Date.now(),
      });
    }
    
    // 2. 检测胜率下降
    if (recentWinRate < 30 && bets.length >= 5) {
      patterns.push({
        type: 'win_rate_drop',
        message: `近期胜率偏低：${recentWinRate.toFixed(1)}%`,
        details: '最近10局胜率低于30%，建议调整策略或暂时观望',
        severity: recentWinRate < 20 ? 'danger' : 'warning',
        timestamp: Date.now(),
      });
    }
    
    // 3. 检测余额不足
    if (systemState) {
      const balance = systemState.balance || 0;
      const minRequired = 100; // 最小所需余额
      
      if (balance < minRequired) {
        patterns.push({
          type: 'balance_low',
          message: '余额不足警告',
          details: `当前余额 ${balance}，低于最低要求 ${minRequired}，无法继续下注`,
          severity: 'danger',
          timestamp: Date.now(),
        });
      }
    }
    
    // 4. 检测大额下注
    const lastBet = bets[bets.length - 1];
    if (lastBet && systemState) {
      const betAmount = lastBet.bet_amount;
      const balance = systemState.balance || 0;
      
      if (betAmount > balance * 0.5) {
        patterns.push({
          type: 'large_bet',
          message: '大额下注警告',
          details: `本次下注金额占余额的${((betAmount / balance) * 100).toFixed(1)}%，建议控制仓位`,
          severity: 'warning',
          timestamp: Date.now(),
        });
      }
    }
    
    setAbnormalPatterns(patterns);
    return patterns;
  }, [consecutiveResults, recentWinRate, systemState, bets]);
  
  // 自动检测异常模式
  useEffect(() => {
    // 使用setTimeout避免同步调用setState
    const timer = setTimeout(() => {
      detectAbnormalPatterns();
    }, 0);
    return () => clearTimeout(timer);
  }, [games, bets, systemState, detectAbnormalPatterns]);
  
  // ====== 智能下注建议 ======
  
  const bettingAdvice = useMemo((): BettingAdvice => {
    const advice: BettingAdvice = {
      canBet: true,
      reason: '可以进行下注',
      confidence: 50,
      suggestedAmount: null,
      riskLevel: 'low',
    };
    
    // 检查数据完整性
    if (hasCriticalIssues) {
      return {
        canBet: false,
        reason: '数据存在异常，请先检查数据完整性',
        confidence: 0,
        suggestedAmount: null,
        riskLevel: 'high',
      };
    }
    
    // 检查余额
    if (!systemState || (systemState.balance || 0) < 100) {
      return {
        canBet: false,
        reason: '余额不足，无法下注',
        confidence: 0,
        suggestedAmount: null,
        riskLevel: 'high',
      };
    }
    
    // 检查连续结果
    if (consecutiveResults) {
      if (consecutiveResults.count >= 7) {
        advice.canBet = false;
        advice.reason = `连续${consecutiveResults.count}局${consecutiveResults.result}，建议观望`;
        advice.confidence = 20;
        advice.riskLevel = 'high';
      } else if (consecutiveResults.count >= 5) {
        advice.reason = `连续${consecutiveResults.count}局${consecutiveResults.result}，谨慎下注`;
        advice.confidence = 40;
        advice.riskLevel = 'medium';
      }
    }
    
    // 检查胜率
    if (recentWinRate < 20) {
      advice.canBet = false;
      advice.reason = '近期胜率过低，建议暂停下注';
      advice.confidence = 10;
      advice.riskLevel = 'high';
    } else if (recentWinRate < 40) {
      advice.riskLevel = 'medium';
      advice.confidence = 45;
    }
    
    // 建议下注金额
    if (advice.canBet && systemState) {
      const balance = systemState.balance || 0;
      const tier = systemState.current_bet_tier || '标准';
      
      const tierMultipliers: Record<string, number> = {
        '保守': 0.02,
        '标准': 0.05,
        '激进': 0.1,
      };
      
      const multiplier = tierMultipliers[tier] || 0.05;
      advice.suggestedAmount = Math.floor(balance * multiplier);
    }
    
    return advice;
  }, [hasCriticalIssues, systemState, consecutiveResults, recentWinRate]);
  
  // ====== 智能提醒 ======

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // 使用ref存储removeAlert，避免循环依赖
  const removeAlertRef = useRef(removeAlert);

  // 使用useEffect更新ref，避免在渲染期间修改
  useEffect(() => {
    removeAlertRef.current = removeAlert;
  }, [removeAlert]);

  const addAlert = useCallback((alert: Omit<SmartAlert, 'id'>) => {
    const newAlert: SmartAlert = {
      ...alert,
      id: generateId(),
    };
    setAlerts(prev => [...prev, newAlert]);

    // 根据类型显示消息
    if (alert.type === 'danger') {
      message.error(alert.message);
    } else if (alert.type === 'warning') {
      message.warning(alert.message);
    } else if (alert.type === 'success') {
      message.success(alert.message);
    } else {
      message.info(alert.message);
    }

    // 自动关闭
    if (alert.autoClose !== false) {
      setTimeout(() => {
        if (removeAlertRef.current) {
          removeAlertRef.current(newAlert.id);
        }
      }, alert.duration || 5000);
    }
  }, []);

  // 根据异常模式自动添加提醒
  useEffect(() => {
    abnormalPatterns.forEach(pattern => {
      addAlert({
        type: pattern.severity,
        title: pattern.type === 'consecutive' ? '连续结果警告' :
               pattern.type === 'win_rate_drop' ? '胜率下降' :
               pattern.type === 'balance_low' ? '余额不足' :
               pattern.type === 'large_bet' ? '大额下注' : '系统提示',
        message: pattern.message,
        autoClose: pattern.severity !== 'danger',
        duration: pattern.severity === 'danger' ? 8000 : 5000,
      });
    });
  }, [abnormalPatterns, addAlert]);
  
  // ====== 数据同步状态 ======
  // 注意：原有的60秒过期提示已被移除，因为页面有React Query的自动刷新机制，
  // 频繁提示用户刷新会造成干扰。
  const lastSyncTime = Date.now();
  const isDataStale = false;
  const markSynced = useCallback(() => {}, []);
  
  return {
    integrityIssues,
    checkDataIntegrity,
    hasCriticalIssues,
    abnormalPatterns,
    detectAbnormalPatterns,
    consecutiveResults,
    recentWinRate,
    bettingAdvice,
    alerts,
    addAlert,
    removeAlert,
    clearAlerts,
    lastSyncTime,
    isDataStale,
    markSynced,
  };
};

export default useSmartDetection;
