/**
 * 游戏状态管理 Hook
 * 统一管理游戏相关的状态和数据加载
 * 适配 React Native，替换了 antd message 为 react-native Alert
 */
import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import * as api from '../services/api';

// ====== 类型定义 ======

export interface SystemState {
  
  status: string;
  boot_number: number;
  game_number: number;
  current_game_result: string | null;
  predict_direction: string | null;
  predict_confidence: number | null;
  current_model_version: string | null;
  current_bet_tier: string;
  balance: number;
  consecutive_errors: number;
  health_score: number;
  pending_bet: {
    direction: string;
    amount: number;
    tier: string;
    game_number: number;
    time: string | null;
  } | null;
  next_game_number: number;
}

export interface GameRecord {
  game_number: number;
  result: string;
  result_time: string | null;
  predict_direction: string | null;
  predict_correct: boolean | null;
  error_id: string | null;
  settlement_status: string | null;
  profit_loss: number;
  balance_after: number;
}

export interface BetRecord {
  game_number: number;
  bet_time: string | null;
  bet_direction: string;
  bet_amount: number;
  bet_tier: string;
  status: string;
  game_result: string | null;
  error_id: string | null;
  settlement_amount: number | null;
  profit_loss: number | null;
  balance_before: number;
  balance_after: number;
  adapt_summary: string | null;
}

export interface LogEntry {
  id: number;
  log_time: string;
  game_number: number | null;
  event_code: string;
  event_type: string;
  event_result: string;
  description: string;
  category: string;
  priority: string;
  is_pinned: boolean;
}

export interface Stats {
  total_games: number;
  hit_count: number;
  miss_count: number;
  accuracy: number;
  balance: number;
}

export interface AnalysisData {
  banker_summary: string;
  player_summary: string;
  combined_summary: string;
  confidence: number;
  bet_tier: string;
  prediction: string | null;
  bet_amount: number | null;
}

interface UseGameStateOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseGameStateReturn {
  // 系统状态
  systemState: SystemState | null;
  stats: Stats | null;
  analysis: AnalysisData | null;
  aiAnalyzing: boolean;
  setAiAnalyzing: (value: boolean) => void;

  // 数据列表
  logs: LogEntry[];
  games: GameRecord[];
  bets: BetRecord[];
  gamesTotal: number;
  betsTotal: number;

  // 分页
  gamePage: number;
  betPage: number;
  setGamePage: (page: number) => void;
  setBetPage: (page: number) => void;

  // 走势图
  roadData: api.FiveRoadsResponse | null;
  roadLoading: boolean;

  // 操作方法
  loadSystemState: () => Promise<void>;
  loadStats: () => Promise<void>;
  loadLogs: (page?: number, category?: string) => Promise<void>;
  loadGames: (page?: number) => Promise<void>;
  loadBets: (page?: number) => Promise<void>;
  loadRoadData: () => Promise<void>;
  loadLatestAnalysis: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

/**
 * 游戏状态管理 Hook
 * @param options 配置选项
 * @returns 游戏状态和操作方法
 */
export const useGameState = (options: UseGameStateOptions): UseGameStateReturn => {
  const { autoRefresh = true, refreshInterval = 5000 } = options;

  // 系统状态
  const [systemState, setSystemState] = useState<SystemState | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // 数据列表
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [gamesTotal, setGamesTotal] = useState(0);
  const [betsTotal, setBetsTotal] = useState(0);

  // 分页
  const [gamePage, setGamePage] = useState(1);
  const [betPage, setBetPage] = useState(1);

  // 走势图
  const [roadData, setRoadData] = useState<api.FiveRoadsResponse | null>(null);
  const [roadLoading, setRoadLoading] = useState(false);

  // 日志分类（内部状态）
  const [logCategory] = useState<string>('');

  // ====== 数据加载方法 ======

  const loadSystemState = useCallback(async () => {
    try {
      const res = await api.getSystemState();
      setSystemState(res.data);
    } catch (err) {
      console.error('[useGameState] 加载系统状态失败:', err);
      Alert.alert('错误', '加载系统状态失败');
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.getStatistics();
      setStats(res.data);
    } catch (err) {
      console.error('[useGameState] 加载统计数据失败:', err);
      Alert.alert('错误', '加载统计数据失败');
    }
  }, []);

  const loadLogs = useCallback(
    async (page = 1, category?: string) => {
      try {
        const cat = category ?? logCategory;
        const res = await api.getLogs({
          category: cat || undefined,
          page,
          page_size: 50,
        });
        setLogs(res.data.data);
      } catch (err) {
        console.error('[useGameState] 加载日志失败:', err);
        Alert.alert('错误', '加载日志失败');
      }
    },
    [logCategory]
  );

  const loadGames = useCallback(
    async (page = 1) => {
      try {
        const res = await api.getGameRecords({
          page,
          page_size: 20,
        });
        setGames(res.data.data);
        if (typeof res.data.total === 'number') setGamesTotal(res.data.total);
      } catch (err) {
        console.error('[useGameState] 加载游戏记录失败:', err);
        Alert.alert('错误', '加载游戏记录失败');
      }
    },
    []
  );

  const loadBets = useCallback(
    async (page = 1) => {
      try {
        const res = await api.getBetRecords({
          page,
          page_size: 20,
        });
        setBets(res.data.data);
        if (typeof res.data.total === 'number') setBetsTotal(res.data.total);
      } catch (err) {
        console.error('[useGameState] 加载下注记录失败:', err);
        Alert.alert('错误', '加载下注记录失败');
      }
    },
    []
  );

  const loadRoadData = useCallback(async () => {
    setRoadLoading(true);
    try {
      const res = await api.getRoadMaps();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (res.data && (res.data as any).roads) {
        setRoadData(res.data as api.FiveRoadsResponse);
      }
    } catch (err) {
      console.error('[useGameState] 加载路图数据失败:', err);
      Alert.alert('错误', '加载路图数据失败');
      // 保留上次数据而非清空
    } finally {
      setRoadLoading(false);
    }
  }, []);

  const loadLatestAnalysis = useCallback(async () => {
    try {
      const res = await api.getLatestAnalysis();
      if (res.data && res.data.has_data) {
        setAnalysis({
          banker_summary: res.data.banker_model?.summary || '',
          player_summary: res.data.player_model?.summary || '',
          combined_summary: res.data.combined_model?.summary || '',
          confidence: res.data.combined_model?.confidence || 0.5,
          bet_tier: res.data.combined_model?.bet_tier || '标准',
          prediction: res.data.combined_model?.prediction || null,
          bet_amount: null,
        });
        setAiAnalyzing(false);
      }
    } catch (err) {
      console.error('[useGameState] 加载AI分析失败:', err);
      Alert.alert('错误', '加载AI分析失败');
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadSystemState(),
      loadStats(),
      loadLogs(),
      loadGames(gamePage),
      loadBets(betPage),
      loadRoadData(),
      loadLatestAnalysis(),
    ]);
  }, [
    loadSystemState,
    loadStats,
    loadLogs,
    loadGames,
    loadBets,
    loadRoadData,
    loadLatestAnalysis,
    gamePage,
    betPage,
  ]);

  // ====== 自动刷新 ======

  useEffect(() => {
    if (!autoRefresh) return;

    // 初始加载
    refreshAll();

    // 定时刷新
    const interval = setInterval(() => {
      loadSystemState();
      loadStats();
      loadLogs();
      loadLatestAnalysis();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [
    autoRefresh,
    refreshInterval,
    refreshAll,
    loadSystemState,
    loadStats,
    loadLogs,
    loadLatestAnalysis,
  ]);

  // 走势图独立刷新（10秒）
  useEffect(() => {
    const interval = setInterval(() => {
      loadRoadData();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadRoadData]);

  return {
    // 系统状态
    systemState,
    stats,
    analysis,
    aiAnalyzing,
    setAiAnalyzing,

    // 数据列表
    logs,
    games,
    bets,
    gamesTotal,
    betsTotal,

    // 分页
    gamePage,
    betPage,
    setGamePage,
    setBetPage,

    // 走势图
    roadData,
    roadLoading,

    // 操作方法
    loadSystemState,
    loadStats,
    loadLogs,
    loadGames,
    loadBets,
    loadRoadData,
    loadLatestAnalysis,
    refreshAll,
  };
};

export default useGameState;
