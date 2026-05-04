/**
 * React Query 数据获取 Hooks
 * 全局缓存层 - 提供带缓存的数据获取能力
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import * as api from '../services/api';
import type { SystemState, Stats, LogEntry, GameRecord, BetRecord, AnalysisData } from '../types/models';

// ====== System State Query ======

interface UseSystemStateQueryOptions {
  enabled?: boolean;
}

export const useSystemStateQuery = (options: UseSystemStateQueryOptions) => {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  return useQuery<SystemState | null>({
    queryKey: queryKeys.systemState(),
    queryFn: async () => {
            const res = await api.getSystemState();
      return res.data;
    },
    enabled: enabled,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
            return queryClient.getQueryData(queryKeys.systemState()) || null;
    },
    // 后台每5秒静默刷新
    refetchInterval: 5000,
    // 数据变化时平滑过渡，不闪烁
    notifyOnChangeProps: ['data', 'error'],
  });
};

// ====== Stats Query ======

interface UseStatsQueryOptions {
  enabled?: boolean;
}

export const useStatsQuery = (options: UseStatsQueryOptions) => {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  return useQuery<Stats | null>({
    queryKey: queryKeys.stats(),
    queryFn: async () => {
            const res = await api.getStatistics();
      return res.data;
    },
    enabled: enabled,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
            return queryClient.getQueryData(queryKeys.stats()) || null;
    },
    refetchInterval: 10000,
    notifyOnChangeProps: ['data', 'error'],
  });
};

// ====== Logs Query ======

interface UseLogsQueryOptions {
  category?: string;
  taskId?: string;
  priority?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export const useLogsQuery = (options: UseLogsQueryOptions) => {
  const { category, taskId, priority, q, page = 1, pageSize = 50, enabled = true } = options;
  const queryClient = useQueryClient();
  const authed = !!api.getToken();

  return useQuery<{
    logs: LogEntry[];
    total: number;
  }>({
    queryKey: queryKeys.logs(category, taskId, priority, q, page, pageSize),
    queryFn: async () => {
            const res = await api.getLogs({
                category: category || undefined,
        priority: priority || undefined,
        task_id: taskId || undefined,
        q: q || undefined,
        page,
        page_size: pageSize,
      });
      return {
        logs: res.data.data || [],
        total: res.data.total || 0,
      };
    },
    enabled: enabled && authed,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
            return queryClient.getQueryData(queryKeys.logs(category, taskId, priority, q, page, pageSize)) || { logs: [], total: 0 };
    },
    notifyOnChangeProps: ['data', 'error'],
  });
};

// ====== Games Query ======

interface UseGamesQueryOptions {
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export const useGamesQuery = (options: UseGamesQueryOptions) => {
  const { page = 1, pageSize = 20, enabled = true } = options;
  const queryClient = useQueryClient();

  return useQuery<{
    games: GameRecord[];
    total: number;
  }>({
    queryKey: queryKeys.games(page),
    queryFn: async () => {
            const res = await api.getGameRecords({
                page,
        page_size: pageSize,
      });
      return {
        games: res.data.data || [],
        total: res.data.total || 0,
      };
    },
    enabled: enabled,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
            return queryClient.getQueryData(queryKeys.games(page)) || { games: [], total: 0 };
    },
    notifyOnChangeProps: ['data', 'error'],
  });
};

// ====== Bets Query ======

interface UseBetsQueryOptions {
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export const useBetsQuery = (options: UseBetsQueryOptions) => {
  const { page = 1, pageSize = 20, enabled = true } = options;
  const queryClient = useQueryClient();
  const authed = !!api.getToken();

  return useQuery<{
    bets: BetRecord[];
    total: number;
  }>({
    queryKey: queryKeys.bets(page),
    queryFn: async () => {
            const res = await api.getBetRecords({
                page,
        page_size: pageSize,
      });
      return {
        bets: res.data.data || [],
        total: res.data.total || 0,
      };
    },
    enabled: enabled && authed,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
            return queryClient.getQueryData(queryKeys.bets(page)) || { bets: [], total: 0 };
    },
    notifyOnChangeProps: ['data', 'error'],
  });
};

// ====== Roads Query ======

interface UseRoadsQueryOptions {
  enabled?: boolean;
}

export const useRoadsQuery = (options: UseRoadsQueryOptions) => {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  return useQuery<api.FiveRoadsResponse | null>({
    queryKey: queryKeys.roads(),
    queryFn: async () => {
            const res = await api.getRoadMaps();
      return res.data;
    },
    enabled: enabled,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
            return queryClient.getQueryData(queryKeys.roads()) || null;
    },
    refetchInterval: 10000,
    notifyOnChangeProps: ['data', 'error'],
  });
};

// ====== Analysis Query ======

interface UseAnalysisQueryOptions {
  enabled?: boolean;
}

export const useAnalysisQuery = (options: UseAnalysisQueryOptions) => {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  return useQuery<AnalysisData | null>({
    queryKey: queryKeys.analysis(),
    queryFn: async () => {
            const res = await api.getLatestAnalysis();
      if (res.data && res.data.has_data) {
        return {
          banker_summary: res.data.banker_model?.summary || '',
          player_summary: res.data.player_model?.summary || '',
          combined_summary: res.data.combined_model?.summary || '',
          confidence: res.data.combined_model?.confidence || 0.5,
          bet_tier: res.data.combined_model?.bet_tier || '标准',
          prediction: res.data.combined_model?.prediction || null,
          bet_amount: null,
          prediction_mode: res.data.prediction_mode,
          engine: res.data.engine || null,
          reasoning_points: res.data.combined_model?.reasoning_points || [],
          reasoning_detail: res.data.combined_model?.reasoning_detail || null,
        };
      }
      return null;
    },
    enabled: enabled,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
            return queryClient.getQueryData(queryKeys.analysis()) || null;
    },
    notifyOnChangeProps: ['data', 'error'],
  });
};

// ====== Mutations ======

// 下注
export const usePlaceBetMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      direction: '庄' | '闲';
      amount: number;
    }) => {
      // 先获取当前游戏状态以获取 gameNumber
      const stateRes = await api.getCurrentGameState();
      const gameNumber = stateRes.data.next_game_number;
      return api.placeBet(gameNumber, params.direction, params.amount);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });
      queryClient.invalidateQueries({ queryKey: ['bets'] });
    },
  });
};

// 开奖结算
export const useRevealResultMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      result: '庄' | '闲' | '和';
    }) => {
      // 先获取当前游戏状态以获取 pending game number
      const stateRes = await api.getCurrentGameState();
      const gameNumber = stateRes.data.pending_bet?.game_number ?? stateRes.data.next_game_number;
      return api.revealGame(gameNumber, params.result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats() });
      queryClient.invalidateQueries({ queryKey: ['games'] });
      queryClient.invalidateQueries({ queryKey: ['bets'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.roads() });
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis() });
      // 补齐对错题本和 AI 记忆的刷新，防止因缓存导致复盘数据不更新
      queryClient.invalidateQueries({ queryKey: ['mistakes'] });
      queryClient.invalidateQueries({ queryKey: ['memories'] });
    },
  });
};

// 添加日志（用于WebSocket接收到新日志时）
export const useAddLogOptimistically = () => {
  const queryClient = useQueryClient();

  return (newLog: LogEntry) => {
    const candidates = queryClient.getQueriesData<{ logs: LogEntry[]; total: number }>({ queryKey: ['logs'] });

    for (const [key] of candidates) {
      const k = key as unknown as (string | number)[];
      if (k.length < 7) continue;

      const category = String(k[1] || '');
      const taskId = String(k[2] || '');
      const priority = String(k[3] || '');
      const q = String(k[4] || '');
      const page = Number(k[5] || 1);
      const pageSize = Number(k[6] || 50);

      if (page !== 1) continue;
      if (q) continue;
      if (category && newLog.category !== category) continue;
      if (taskId && (newLog.task_id || '') !== taskId) continue;
      if (priority && newLog.priority !== priority) continue;

      queryClient.setQueryData(
        key,
        (oldData: { logs: LogEntry[]; total: number } | undefined) => {
          if (!oldData) return { logs: [newLog], total: 1 };
          if (newLog.id && oldData.logs.some(l => l.id === newLog.id)) {
            return oldData;
          }

          const maxLimit = Math.max(pageSize, 1);
          return {
            logs: [newLog, ...oldData.logs].slice(0, maxLimit),
            total: oldData.total + 1,
          };
        }
      );
    }
  };
};

export const useAddLogsOptimistically = () => {
  const queryClient = useQueryClient();

  return (newLogs: LogEntry[]) => {
    if (!Array.isArray(newLogs) || newLogs.length === 0) return;

    const logs = newLogs.filter(Boolean);
    if (logs.length === 0) return;

    const candidates = queryClient.getQueriesData<{ logs: LogEntry[]; total: number }>({ queryKey: ['logs'] });
    const insertLogs = [...logs].reverse();

    for (const [key] of candidates) {
      const k = key as unknown as (string | number)[];
      if (k.length < 7) continue;

      const category = String(k[1] || '');
      const taskId = String(k[2] || '');
      const priority = String(k[3] || '');
      const q = String(k[4] || '');
      const page = Number(k[5] || 1);
      const pageSize = Number(k[6] || 50);

      if (page !== 1) continue;
      if (q) continue;

      queryClient.setQueryData(
        key,
        (oldData: { logs: LogEntry[]; total: number } | undefined) => {
          const oldLogs = oldData?.logs || [];
          const existingIds = new Set(oldLogs.map((l) => l.id).filter(Boolean));

          const accepted: LogEntry[] = [];
          for (const l of insertLogs) {
            if (category && l.category !== category) continue;
            if (taskId && (l.task_id || '') !== taskId) continue;
            if (priority && l.priority !== priority) continue;
            if (l.id && existingIds.has(l.id)) continue;
            accepted.push(l);
          }

          if (accepted.length === 0) return oldData || { logs: [], total: 0 };

          const maxLimit = Math.max(pageSize, 1);
          const nextLogs = [...accepted, ...oldLogs].slice(0, maxLimit);
          const nextTotal = (oldData?.total || 0) + accepted.length;

          return { logs: nextLogs, total: nextTotal };
        }
      );
    }
  };
};

// 添加下注记录（用于WebSocket接收到新下注时）
export const useAddBetOptimistically = () => {
  const queryClient = useQueryClient();

  return (newBet: BetRecord) => {
    queryClient.setQueryData(
      queryKeys.bets(1),
      (oldData: { bets: BetRecord[]; total: number } | undefined) => {
        if (!oldData) return { bets: [newBet], total: 1 };
        // 去重检查，防止并发推送导致数据重复
        if (oldData.bets.some(b => b.game_number === newBet.game_number)) {
          return oldData;
        }
        return {
          bets: [newBet, ...oldData.bets].slice(0, 20),
          total: oldData.total + 1,
        };
      }
    );
  };
};

// 更新下注记录（用于WebSocket接收到结算时）
export const useUpdateBetOptimistically = () => {
  const queryClient = useQueryClient();

  return (gameNumber: number, updates: Partial<BetRecord>) => {
    queryClient.setQueryData(
      queryKeys.bets(1),
      (oldData: { bets: BetRecord[]; total: number } | undefined) => {
        if (!oldData) return oldData;
        return {
          bets: oldData.bets.map(bet =>
            bet.game_number === gameNumber ? { ...bet, ...updates } : bet
          ),
          total: oldData.total,
        };
      }
    );
  };
};

// 添加游戏记录（用于WebSocket接收到开奖时）
export const useAddGameOptimistically = () => {
  const queryClient = useQueryClient();

  return (newGame: GameRecord) => {
    // 模糊匹配所有包含 'games' 的 queryKey，以适配不同的 pageSize (比如 DashboardPage 里的 pageSize=100)
    queryClient.setQueriesData(
      { queryKey: ['games'] },
      (oldData: { games: GameRecord[]; total: number } | undefined) => {
        if (!oldData) return { games: [newGame], total: 1 };
        
        // 去重检查，防止相同局号游戏重复添加
        if (oldData.games.some(g => g.game_number === newGame.game_number)) {
          return oldData;
        }

        // 动态继承当前的缓存长度，防止像之前那样硬编码 .slice(0, 20) 导致瞬间截断 80 条数据并引发走势图崩塌闪烁
        const currentLength = oldData.games.length;
        const maxLimit = currentLength > 0 ? currentLength : 20;
        
        return {
          games: [newGame, ...oldData.games].slice(0, maxLimit),
          total: oldData.total + 1,
        };
      }
    );
  };
};

// 更新五路走势图（用于WebSocket接收到开奖时）
export const useUpdateRoadsOptimistically = () => {
  const queryClient = useQueryClient();

  return (newRoadData: api.FiveRoadsResponse) => {
    queryClient.setQueryData(queryKeys.roads(), newRoadData);
  };
};

// 更新系统状态（用于WebSocket接收到状态更新时）
export const useUpdateStateOptimistically = () => {
  const queryClient = useQueryClient();

  return async (updates: Partial<SystemState>) => {
    // 1. 取消任何进行中的查询，防止被旧的轮询数据覆盖
    await queryClient.cancelQueries({ queryKey: queryKeys.systemState() });
    
    // 2. 乐观更新
    queryClient.setQueryData(
      queryKeys.systemState(),
      (oldData: SystemState | undefined) => {
        if (!oldData) return oldData;
        return { ...oldData, ...updates };
      }
    );
  };
};

// 更新AI分析数据（用于WebSocket接收到AI分析结果时）
export const useUpdateAnalysisOptimistically = () => {
  const queryClient = useQueryClient();

  return (analysisData: AnalysisData) => {
    queryClient.setQueryData(queryKeys.analysis(), analysisData);
  };
};

// ====== Mistake Records Query ======

export interface MistakeRecord {
  id: number;
  
  boot_number: number;
  game_number: number;
  error_id: string;
  error_type: string;
  predict_direction: string;
  actual_result: string;
  banker_summary: string | null;
  player_summary: string | null;
  combined_summary: string | null;
  confidence: number | null;
  road_snapshot: unknown;
  analysis: string | null;
  correction: string | null;
  created_at: string;
}

interface UseMistakesQueryOptions {
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export const useMistakesQuery = (options: UseMistakesQueryOptions) => {
  const { page = 1, pageSize = 20, enabled = true } = options;
  const queryClient = useQueryClient();

  return useQuery<{
    mistakes: MistakeRecord[];
    total: number;
  }>({
    queryKey: ['mistakes', page],
    queryFn: async () => {
            const res = await api.getMistakeRecords({
                page,
        page_size: pageSize,
      });
      const rawData = res.data.data || [];
      const mapped: MistakeRecord[] = rawData.map((r: unknown) => {
        const item = r as Record<string, unknown>;
        return {
          id: item.id as number,
          
          boot_number: item.boot_number as number,
          game_number: item.game_number as number,
          error_id: item.error_id as string,
          error_type: item.error_type as string,
          predict_direction: item.predict_direction as string,
          actual_result: item.actual_result as string,
          banker_summary: item.banker_summary as string | null,
          player_summary: item.player_summary as string | null,
          combined_summary: item.combined_summary as string | null,
          confidence: item.confidence as number | null,
          road_snapshot: item.road_snapshot,
          analysis: item.analysis as string | null,
          correction: item.correction as string | null,
          created_at: item.created_at as string,
        };
      });
      return { mistakes: mapped, total: res.data.total || 0 };
    },
    enabled: enabled,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
            return queryClient.getQueryData(['mistakes', page]) || { mistakes: [], total: 0 };
    },
    notifyOnChangeProps: ['data', 'error'],
  });
};
