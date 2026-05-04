/**
 * React Query 客户端配置
 * 乐观UI策略 - 数据永不过期，立即显示，后台静默刷新
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 数据永不过期 - 始终立即显示缓存数据
      staleTime: Infinity,
      // 数据保留30分钟
      gcTime: 30 * 60 * 1000,
      // 失败时重试2次
      retry: 2,
      // 重试间隔
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // 窗口重新聚焦时不刷新（避免干扰用户）
      refetchOnWindowFocus: false,
      // 网络重连时刷新
      refetchOnReconnect: true,
      // 挂载时始终使用缓存数据，后台静默刷新
      refetchOnMount: 'always',
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
  systemState: () => ['systemState'] as const,
  // 统计数据
  stats: () => ['stats'] as const,
  // 日志
  logs: (category?: string, taskId?: string, priority?: string, q?: string, page: number = 1, pageSize: number = 50) => ['logs', category || '', taskId || '', priority || '', q || '', page, pageSize] as const,
  // 游戏记录
  games: (page: number = 1, pageSize: number = 20) => ['games', page, pageSize] as const,
  // 下注记录
  bets: (page: number = 1, pageSize: number = 20) => ['bets', page, pageSize] as const,
  // 错题本
  mistakes: (page: number = 1, pageSize: number = 20) => ['mistakes', page, pageSize] as const,
  // 走势图
  roads: () => ['roads'] as const,
  // AI分析
  analysis: () => ['analysis'] as const,
};

export default queryClient;
