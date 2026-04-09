/**
 * React Query 客户端配置
 * 全局缓存层 - 统一管理数据获取和缓存
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 数据缓存时间：5分钟
      staleTime: 5 * 60 * 1000,
      // 数据保留时间：10分钟
      gcTime: 10 * 60 * 1000,
      // 失败时重试3次
      retry: 3,
      // 重试间隔递增
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // 窗口重新聚焦时刷新数据
      refetchOnWindowFocus: true,
      // 网络重连时刷新数据
      refetchOnReconnect: true,
    },
    mutations: {
      // 失败时重试1次
      retry: 1,
    },
  },
});

// Query Key 工厂 - 统一管理缓存键
export const queryKeys = {
  // 系统状态
  systemState: (tableId: string) => ['systemState', tableId] as const,
  // 统计数据
  stats: (tableId: string) => ['stats', tableId] as const,
  // 日志
  logs: (tableId: string, category?: string) => ['logs', tableId, category] as const,
  // 游戏记录
  games: (tableId: string, page: number) => ['games', tableId, page] as const,
  // 下注记录
  bets: (tableId: string, page: number) => ['bets', tableId, page] as const,
  // 走势图
  roads: (tableId: string) => ['roads', tableId] as const,
  // AI分析
  analysis: (tableId: string) => ['analysis', tableId] as const,
};

export default queryClient;
