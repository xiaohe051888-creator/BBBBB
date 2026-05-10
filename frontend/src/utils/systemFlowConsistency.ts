import type { SystemState } from '../types/models';

export type PredictionMode = 'ai' | 'single_ai' | 'rule';

export interface WorkflowAnalysisSnapshot {
  prediction?: string | null;
  confidence?: number | null;
  combined_summary?: string | null;
}

export interface DashboardWorkflowInput {
  hasGameData: boolean;
  hasPendingBet: boolean;
  systemStatus?: string | null;
  nextGameNumber?: number | null;
  analysis: WorkflowAnalysisSnapshot | null;
  analysisFetching: boolean;
}

export interface DashboardWorkflowStage {
  type:
    | 'idle'
    | 'analyzing'
    | 'analyzed_pending_bet'
    | 'waiting_reveal'
    | 'boot_finished';
  showAnalysisLoading: boolean;
  showCompletedAnalysis: boolean;
}

type DashboardRealtimeEvent =
  | {
      type: 'bet_placed';
      payload: { game_number: number; direction: string; amount: number; tier: string };
    }
  | {
      type: 'game_revealed';
      payload: { game_number: number; balance?: number | null; result?: string | null };
    }
  | {
      type: 'state_update';
      payload: Partial<SystemState>;
    };

export const formatAccuracyPercent = (accuracy?: number | null) => {
  return `${(accuracy || 0).toFixed(1)}%`;
};

export const resolvePredictionMode = (
  systemMode?: PredictionMode | null,
  analysisMode?: PredictionMode | null,
): PredictionMode => {
  return systemMode || analysisMode || 'rule';
};

export const deriveDashboardWorkflowStage = (
  input: DashboardWorkflowInput,
): DashboardWorkflowStage => {
  const nextGameNumber = input.nextGameNumber || 0;

  if (!input.hasGameData) {
    return {
      type: 'idle',
      showAnalysisLoading: false,
      showCompletedAnalysis: false,
    };
  }

  if (nextGameNumber > 72) {
    return {
      type: 'boot_finished',
      showAnalysisLoading: false,
      showCompletedAnalysis: false,
    };
  }

  if (input.hasPendingBet) {
    return {
      type: 'waiting_reveal',
      showAnalysisLoading: false,
      showCompletedAnalysis: !!input.analysis,
    };
  }

  if (input.analysisFetching || input.systemStatus === '分析中') {
    return {
      type: 'analyzing',
      showAnalysisLoading: true,
      showCompletedAnalysis: false,
    };
  }

  if (input.analysis?.prediction) {
    return {
      type: 'analyzed_pending_bet',
      showAnalysisLoading: false,
      showCompletedAnalysis: true,
    };
  }

  return {
    type: 'idle',
    showAnalysisLoading: false,
    showCompletedAnalysis: false,
  };
};

export const applyDashboardRealtimeUpdate = (
  current: SystemState,
  event: DashboardRealtimeEvent,
): SystemState => {
  if (event.type === 'bet_placed') {
    return {
      ...current,
      status: '等待开奖',
      pending_bet: {
        direction: event.payload.direction,
        amount: event.payload.amount,
        tier: event.payload.tier,
        game_number: event.payload.game_number,
        time: new Date().toISOString(),
      },
      next_game_number: event.payload.game_number,
      predict_direction: event.payload.direction,
      current_bet_tier: event.payload.tier,
    };
  }

  if (event.type === 'game_revealed') {
    return {
      ...current,
      status: '分析中',
      game_number: event.payload.game_number,
      next_game_number: event.payload.game_number + 1,
      current_game_result: event.payload.result ?? current.current_game_result,
      pending_bet: null,
      balance: typeof event.payload.balance === 'number' ? event.payload.balance : current.balance,
    };
  }

  return {
    ...current,
    ...event.payload,
  };
};
