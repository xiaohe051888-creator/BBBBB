/**
 * 自定义 Hooks 统一导出
 */
export { useAdminLogin } from './useAdminLogin';
export { useWebSocket } from './useWebSocket';
export { useWaitTimer } from './useWaitTimer';
export { useLoading } from './useLoading';
export { useDataRefreshIndicator } from './useDataRefreshIndicator';

// 智能检测系统
export { useSmartDetection } from './useSmartDetection';
export { useWorkflowState } from './useWorkflowState';

// 系统诊断（实时状态监控）
export { useSystemDiagnostics } from './useSystemDiagnostics';

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
  useAddLogsOptimistically,
  useAddBetOptimistically,
  useUpdateBetOptimistically,
  useAddGameOptimistically,
  useUpdateRoadsOptimistically,
  useUpdateStateOptimistically,
  useUpdateAnalysisOptimistically,
  // Mistake Records
  useMistakesQuery,
  type MistakeRecord,
} from './useQueries';

// 类型导出
export type {
  BetRecord,
  GameRecord,
  LogEntry,
  SystemState,
  Stats,
  AnalysisData,
} from '../types/models';
export type {
  DataIntegrityIssue,
  AbnormalPattern,
  SmartAlert,
  BettingAdvice,
} from './useSmartDetection';

export type {
  WorkflowStatus,
  WorkflowState,
  WorkflowTimer,
} from './useWorkflowState';

export type {
  SystemDiagnostics,
  SystemIssue,
  AIModelStatus,
  WsStatus,
  ServiceStatus,
} from './useSystemDiagnostics';
