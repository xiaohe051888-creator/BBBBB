import { describe, expect, it } from 'vitest';

import {
  applyDashboardRealtimeUpdate,
  deriveDashboardWorkflowStage,
  formatAccuracyPercent,
  resolvePredictionMode,
  type DashboardWorkflowStage,
} from './systemFlowConsistency';

describe('systemFlowConsistency', () => {
  it('treats stats accuracy as an already-scaled percentage', () => {
    expect(formatAccuracyPercent(55.3)).toBe('55.3%');
    expect(formatAccuracyPercent(0)).toBe('0.0%');
  });

  it('falls back to rule mode when no runtime mode is available yet', () => {
    expect(resolvePredictionMode(undefined, undefined)).toBe('rule');
  });

  it('prefers system state mode over analysis mode', () => {
    expect(resolvePredictionMode('single_ai', 'ai')).toBe('single_ai');
  });

  it('returns waiting_reveal when a pending bet exists', () => {
    const stage = deriveDashboardWorkflowStage({
      hasGameData: true,
      hasPendingBet: true,
      systemStatus: '等待开奖',
      nextGameNumber: 18,
      analysis: {
        prediction: '庄',
        confidence: 0.78,
        combined_summary: '综合建议本局继续跟庄',
      },
      analysisFetching: true,
    });

    expect(stage.type).toBe<DashboardWorkflowStage['type']>('waiting_reveal');
    expect(stage.showAnalysisLoading).toBe(false);
    expect(stage.showCompletedAnalysis).toBe(true);
  });

  it('returns analyzing only before a pending bet exists', () => {
    const stage = deriveDashboardWorkflowStage({
      hasGameData: true,
      hasPendingBet: false,
      systemStatus: '分析中',
      nextGameNumber: 18,
      analysis: null,
      analysisFetching: true,
    });

    expect(stage.type).toBe<DashboardWorkflowStage['type']>('analyzing');
    expect(stage.showAnalysisLoading).toBe(true);
    expect(stage.showCompletedAnalysis).toBe(false);
  });

  it('returns analyzed_pending_bet when analysis is ready but pending bet is not synced yet', () => {
    const stage = deriveDashboardWorkflowStage({
      hasGameData: true,
      hasPendingBet: false,
      systemStatus: '运行中',
      nextGameNumber: 18,
      analysis: {
        prediction: '庄',
        confidence: 0.78,
        combined_summary: '综合建议本局继续跟庄',
      },
      analysisFetching: false,
    });

    expect(stage.type).toBe<DashboardWorkflowStage['type']>('analyzed_pending_bet');
    expect(stage.showCompletedAnalysis).toBe(true);
  });

  it('keeps pending bet and next game number aligned after a bet is placed', () => {
    const nextState = applyDashboardRealtimeUpdate(
      {
        status: '分析中',
        boot_number: 1,
        game_number: 17,
        current_game_result: '庄',
        predict_direction: '庄',
        predict_confidence: 0.78,
        current_model_version: null,
        current_bet_tier: '标准',
        balance: 10000,
        consecutive_errors: 0,
        health_score: null,
        pending_bet: null,
        next_game_number: 18,
        prediction_mode: 'single_ai',
      },
      {
        type: 'bet_placed',
        payload: {
          game_number: 18,
          direction: '庄',
          amount: 100,
          tier: '标准',
        },
      },
    );

    expect(nextState.status).toBe('等待开奖');
    expect(nextState.pending_bet?.game_number).toBe(18);
    expect(nextState.next_game_number).toBe(18);
    expect(nextState.predict_direction).toBe('庄');
  });

  it('clears pending bet and advances next game number after reveal', () => {
    const nextState = applyDashboardRealtimeUpdate(
      {
        status: '等待开奖',
        boot_number: 1,
        game_number: 17,
        current_game_result: '庄',
        predict_direction: '庄',
        predict_confidence: 0.78,
        current_model_version: null,
        current_bet_tier: '标准',
        balance: 9900,
        consecutive_errors: 0,
        health_score: null,
        pending_bet: {
          direction: '庄',
          amount: 100,
          tier: '标准',
          game_number: 18,
          time: '2026-05-10T00:00:00.000Z',
        },
        next_game_number: 18,
        prediction_mode: 'single_ai',
      },
      {
        type: 'game_revealed',
        payload: {
          game_number: 18,
          balance: 10100,
          result: '庄',
        },
      },
    );

    expect(nextState.status).toBe('分析中');
    expect(nextState.pending_bet).toBeNull();
    expect(nextState.game_number).toBe(18);
    expect(nextState.next_game_number).toBe(19);
    expect(nextState.balance).toBe(10100);
  });
});
