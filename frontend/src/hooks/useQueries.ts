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

  return useQuery<Stats | null>({
    queryKey: tableId ? queryKeys.stats(tableId) : ['stats', ''],
    queryFn: async () => {
      if (!tableId) return null;
      const res = await api.getStatistics(tableId);
      return res.data;
    },
    enabled: !!tableId && enabled,
    staleTime: 10000,
    refetchInterval: 10000,
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
    staleTime: 3000,
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
    staleTime: 10000,
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
    staleTime: 10000,
  });
};

// ====== Roads Query ======

interface UseRoadsQueryOptions {
  tableId: string | undefined;
  enabled?: boolean;
}

export const useRoadsQuery = (options: UseRoadsQueryOptions) => {
  const { tableId, enabled = true } = options;

  return useQuery<api.FiveRoadsResponse | null>({
    queryKey: tableId ? queryKeys.roads(tableId) : ['roads', ''],
    queryFn: async () => {
      if (!tableId) return null;
      const res = await api.getRoadMaps(tableId);
      return res.data;
    },
    enabled: !!tableId && enabled,
    staleTime: 5000,
    refetchInterval: 10000,
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
