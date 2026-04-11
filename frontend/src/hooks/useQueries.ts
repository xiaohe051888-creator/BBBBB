/**
 * React Query 数据获取 Hooks
 * 全局缓存层 - 提供带缓存的数据获取能力
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import * as api from '../services/api';
import type { SystemState, Stats, LogEntry, GameRecord, BetRecord, AnalysisData } from './useGameState';

// ====== System State Query ======

interface UseSystemStateQueryOptions {
  tableId: string | undefined;
  enabled?: boolean;
}

export const useSystemStateQuery = (options: UseSystemStateQueryOptions) => {
  const { tableId, enabled = true } = options;
  const queryClient = useQueryClient();

  return useQuery<SystemState | null>({
    queryKey: tableId ? queryKeys.systemState(tableId) : ['systemState', ''],
    queryFn: async () => {
      if (!tableId) return null;
      const res = await api.getSystemState(tableId);
      return res.data;
    },
    enabled: !!tableId && enabled,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
      if (!tableId) return null;
      return queryClient.getQueryData(queryKeys.systemState(tableId)) || null;
    },
    // 后台每5秒静默刷新
    refetchInterval: 5000,
    // 数据变化时平滑过渡，不闪烁
    notifyOnChangeProps: ['data', 'error'],
  });
};

// ====== Stats Query ======

interface UseStatsQueryOptions {
  tableId: string | undefined;
  enabled?: boolean;
}

export const useStatsQuery = (options: UseStatsQueryOptions) => {
  const { tableId, enabled = true } = options;
  const queryClient = useQueryClient();

  return useQuery<Stats | null>({
    queryKey: tableId ? queryKeys.stats(tableId) : ['stats', ''],
    queryFn: async () => {
      if (!tableId) return null;
      const res = await api.getStatistics(tableId);
      return res.data;
    },
    enabled: !!tableId && enabled,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
      if (!tableId) return null;
      return queryClient.getQueryData(queryKeys.stats(tableId)) || null;
    },
    refetchInterval: 10000,
    notifyOnChangeProps: ['data', 'error'],
  });
};

// ====== Logs Query ======

interface UseLogsQueryOptions {
  tableId: string | undefined;
  category?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export const useLogsQuery = (options: UseLogsQueryOptions) => {
  const { tableId, category, page = 1, pageSize = 50, enabled = true } = options;
  const queryClient = useQueryClient();

  return useQuery<{
    logs: LogEntry[];
    total: number;
  }>({
    queryKey: tableId ? queryKeys.logs(tableId, category) : ['logs', ''],
    queryFn: async () => {
      if (!tableId) return { logs: [], total: 0 };
      const res = await api.getLogs({
        table_id: tableId,
        category: category || undefined,
        page,
        page_size: pageSize,
      });
      return {
        logs: res.data.data || [],
        total: res.data.total || 0,
      };
    },
    enabled: !!tableId && enabled,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
      if (!tableId) return { logs: [], total: 0 };
      return queryClient.getQueryData(queryKeys.logs(tableId, category)) || { logs: [], total: 0 };
    },
    notifyOnChangeProps: ['data', 'error'],
  });
};

// ====== Games Query ======

interface UseGamesQueryOptions {
  tableId: string | undefined;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export const useGamesQuery = (options: UseGamesQueryOptions) => {
  const { tableId, page = 1, pageSize = 20, enabled = true } = options;
  const queryClient = useQueryClient();

  return useQuery<{
    games: GameRecord[];
    total: number;
  }>({
    queryKey: tableId ? queryKeys.games(tableId, page) : ['games', '', page],
    queryFn: async () => {
      if (!tableId) return { games: [], total: 0 };
      const res = await api.getGameRecords({
        table_id: tableId,
        page,
        page_size: pageSize,
      });
      return {
        games: res.data.data || [],
        total: res.data.total || 0,
      };
    },
    enabled: !!tableId && enabled,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
      if (!tableId) return { games: [], total: 0 };
      return queryClient.getQueryData(queryKeys.games(tableId, page)) || { games: [], total: 0 };
    },
    notifyOnChangeProps: ['data', 'error'],
  });
};

// ====== Bets Query ======

interface UseBetsQueryOptions {
  tableId: string | undefined;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export const useBetsQuery = (options: UseBetsQueryOptions) => {
  const { tableId, page = 1, pageSize = 20, enabled = true } = options;
  const queryClient = useQueryClient();

  return useQuery<{
    bets: BetRecord[];
    total: number;
  }>({
    queryKey: tableId ? queryKeys.bets(tableId, page) : ['bets', '', page],
    queryFn: async () => {
      if (!tableId) return { bets: [], total: 0 };
      const res = await api.getBetRecords({
        table_id: tableId,
        page,
        page_size: pageSize,
      });
      return {
        bets: res.data.data || [],
        total: res.data.total || 0,
      };
    },
    enabled: !!tableId && enabled,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
      if (!tableId) return { bets: [], total: 0 };
      return queryClient.getQueryData(queryKeys.bets(tableId, page)) || { bets: [], total: 0 };
    },
    notifyOnChangeProps: ['data', 'error'],
  });
};

// ====== Roads Query ======

interface UseRoadsQueryOptions {
  tableId: string | undefined;
  enabled?: boolean;
}

export const useRoadsQuery = (options: UseRoadsQueryOptions) => {
  const { tableId, enabled = true } = options;
  const queryClient = useQueryClient();

  return useQuery<api.FiveRoadsResponse | null>({
    queryKey: tableId ? queryKeys.roads(tableId) : ['roads', ''],
    queryFn: async () => {
      if (!tableId) return null;
      const res = await api.getRoadMaps(tableId);
      return res.data;
    },
    enabled: !!tableId && enabled,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
      if (!tableId) return null;
      return queryClient.getQueryData(queryKeys.roads(tableId)) || null;
    },
    refetchInterval: 10000,
    notifyOnChangeProps: ['data', 'error'],
  });
};

// ====== Analysis Query ======

interface UseAnalysisQueryOptions {
  tableId: string | undefined;
  enabled?: boolean;
}

export const useAnalysisQuery = (options: UseAnalysisQueryOptions) => {
  const { tableId, enabled = true } = options;
  const queryClient = useQueryClient();

  return useQuery<AnalysisData | null>({
    queryKey: tableId ? queryKeys.analysis(tableId) : ['analysis', ''],
    queryFn: async () => {
      if (!tableId) return null;
      const res = await api.getLatestAnalysis(tableId);
      if (res.data && res.data.has_data) {
        return {
          banker_summary: res.data.banker_model?.summary || '',
          player_summary: res.data.player_model?.summary || '',
          combined_summary: res.data.combined_model?.summary || '',
          confidence: res.data.combined_model?.confidence || 0.5,
          bet_tier: res.data.combined_model?.bet_tier || '标准',
          prediction: res.data.combined_model?.prediction || null,
          bet_amount: null,
        };
      }
      return null;
    },
    enabled: !!tableId && enabled,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
      if (!tableId) return null;
      return queryClient.getQueryData(queryKeys.analysis(tableId)) || null;
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
      tableId: string;
      direction: '庄' | '闲';
      amount: number;
    }) => {
      // 先获取当前游戏状态以获取 gameNumber
      const stateRes = await api.getCurrentGameState(params.tableId);
      const gameNumber = stateRes.data.next_game_number;
      return api.placeBet(params.tableId, gameNumber, params.direction, params.amount);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.systemState(variables.tableId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bets(variables.tableId, 1) });
    },
  });
};

// 开奖结算
export const useRevealResultMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      tableId: string;
      result: '庄' | '闲' | '和';
    }) => {
      // 先获取当前游戏状态以获取 pending game number
      const stateRes = await api.getCurrentGameState(params.tableId);
      const gameNumber = stateRes.data.pending_bet?.game_number ?? stateRes.data.next_game_number;
      return api.revealGame(params.tableId, gameNumber, params.result);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.systemState(variables.tableId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats(variables.tableId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.games(variables.tableId, 1) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bets(variables.tableId, 1) });
      queryClient.invalidateQueries({ queryKey: queryKeys.roads(variables.tableId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis(variables.tableId) });
    },
  });
};

// 添加日志（用于WebSocket接收到新日志时）
export const useAddLogOptimistically = () => {
  const queryClient = useQueryClient();

  return (tableId: string, newLog: LogEntry) => {
    queryClient.setQueryData(
      queryKeys.logs(tableId),
      (oldData: { logs: LogEntry[]; total: number } | undefined) => {
        if (!oldData) return { logs: [newLog], total: 1 };
        return {
          logs: [newLog, ...oldData.logs].slice(0, 50),
          total: oldData.total + 1,
        };
      }
    );
  };
};

// 添加下注记录（用于WebSocket接收到新下注时）
export const useAddBetOptimistically = () => {
  const queryClient = useQueryClient();

  return (tableId: string, newBet: BetRecord) => {
    queryClient.setQueryData(
      queryKeys.bets(tableId, 1),
      (oldData: { bets: BetRecord[]; total: number } | undefined) => {
        if (!oldData) return { bets: [newBet], total: 1 };
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

  return (tableId: string, gameNumber: number, updates: Partial<BetRecord>) => {
    queryClient.setQueryData(
      queryKeys.bets(tableId, 1),
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

  return (tableId: string, newGame: GameRecord) => {
    queryClient.setQueryData(
      queryKeys.games(tableId, 1),
      (oldData: { games: GameRecord[]; total: number } | undefined) => {
        if (!oldData) return { games: [newGame], total: 1 };
        return {
          games: [newGame, ...oldData.games].slice(0, 20),
          total: oldData.total + 1,
        };
      }
    );
  };
};

// 更新五路走势图（用于WebSocket接收到开奖时）
export const useUpdateRoadsOptimistically = () => {
  const queryClient = useQueryClient();

  return (tableId: string, newRoadData: api.FiveRoadsResponse) => {
    queryClient.setQueryData(queryKeys.roads(tableId), newRoadData);
  };
};

// 更新系统状态（用于WebSocket接收到状态更新时）
export const useUpdateStateOptimistically = () => {
  const queryClient = useQueryClient();

  return (tableId: string, updates: Partial<SystemState>) => {
    queryClient.setQueryData(
      queryKeys.systemState(tableId),
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

  return (tableId: string, analysisData: AnalysisData) => {
    queryClient.setQueryData(queryKeys.analysis(tableId), analysisData);
  };
};

// ====== Mistake Records Query ======

export interface MistakeRecord {
  id: number;
  table_id: string;
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
  tableId: string | undefined;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export const useMistakesQuery = (options: UseMistakesQueryOptions) => {
  const { tableId, page = 1, pageSize = 20, enabled = true } = options;
  const queryClient = useQueryClient();

  return useQuery<{
    mistakes: MistakeRecord[];
    total: number;
  }>({
    queryKey: tableId ? ['mistakes', tableId, page] : ['mistakes', '', page],
    queryFn: async () => {
      if (!tableId) return { mistakes: [], total: 0 };
      const res = await api.getMistakeRecords({
        table_id: tableId,
        page,
        page_size: pageSize,
      });
      const rawData = res.data.data || [];
      const mapped: MistakeRecord[] = rawData.map((r: unknown) => {
        const item = r as Record<string, unknown>;
        return {
          id: item.id as number,
          table_id: item.table_id as string,
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
    enabled: !!tableId && enabled,
    // 乐观UI：使用缓存数据立即显示
    placeholderData: () => {
      if (!tableId) return { mistakes: [], total: 0 };
      return queryClient.getQueryData(['mistakes', tableId, page]) || { mistakes: [], total: 0 };
    },
    notifyOnChangeProps: ['data', 'error'],
  });
};
