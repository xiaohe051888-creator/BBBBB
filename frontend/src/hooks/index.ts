/**
 * 自定义 Hooks 统一导出
 */
export { useAdminLogin } from './useAdminLogin';
export { useGameState } from './useGameState';
export { useWebSocket } from './useWebSocket';
export { useWaitTimer } from './useWaitTimer';

// React Query Hooks (带全局缓存)
export {
  useSystemStateQuery,
  useStatsQuery,
  useLogsQuery,
  useGamesQuery,
  useBetsQuery,
  useRoadsQuery,
  useAnalysisQuery,
  usePlaceBetMutation,
  useRevealResultMutation,
  useAddLogOptimistically,
} from './useQueries';
