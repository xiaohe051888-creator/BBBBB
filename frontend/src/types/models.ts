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
  prediction_mode?: 'ai' | 'rule';
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