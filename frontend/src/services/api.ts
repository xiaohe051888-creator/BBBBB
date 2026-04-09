/**
 * API 服务层 - 百家乐分析预测系统（手动模式）
 * 含 JWT 认证拦截器 + WebSocket 认证
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// ============ Token 工具函数 ============

const TOKEN_KEY = 'admin_token';

/** 获取存储的JWT token */
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/** 保存token */
export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

/** 清除token（登出） */
export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

// ============ Axios 实例 ============

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ====== 请求拦截器：自动附加 JWT Token ======
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ====== 响应拦截器：统一处理401错误 ======
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      console.warn('认证失败(401)，请重新登录');
    }
    return Promise.reject(error);
  },
);

// ====== 系统状态 ======

export const getSystemState = async (tableId: string) => {
  return api.get('/system/state', { params: { table_id: tableId } });
};

export const getHealthScore = async (tableId: string) => {
  return api.get('/system/health', { params: { table_id: tableId } });
};

// ====== 手动游戏 API ======

export interface GameUploadItem {
  game_number: number;
  result: '庄' | '闲' | '和';
}

export interface UploadResponse {
  success: boolean;
  uploaded: number;
  boot_number: number;
  max_game_number: number;
  next_game_number: number;
  message: string;
}

export interface RevealResponse {
  success: boolean;
  game_number: number;
  result: string;
  predict_direction: string | null;
  predict_correct: boolean | null;
  settlement: {
    status: string;
    profit_loss: number;
    settlement_amount: number;
    reason: string;
  };
  balance: number;
  next_game_number: number;
  message: string;
}

export interface CurrentGameState {
  table_id: string;
  status: string;
  boot_number: number;
  next_game_number: number;
  predict_direction: string | null;
  predict_confidence: number | null;
  predict_bet_tier: string | null;
  predict_bet_amount: number | null;
  pending_bet: {
    direction: string;
    amount: number;
    tier: string;
    game_number: number;
    time: string | null;
  } | null;
  balance: number;
  consecutive_errors: number;
  analysis: {
    banker_summary: string | null;
    player_summary: string | null;
    combined_summary: string | null;
    time: string | null;
  } | null;
}

/** 手动上传批量开奖记录（最多66局），上传后自动触发AI分析 */
export const uploadGameResults = async (
  tableId: string,
  games: GameUploadItem[],
  bootNumber?: number,
) => {
  return api.post<UploadResponse>('/games/upload', {
    table_id: tableId,
    games,
    boot_number: bootNumber,
  });
};

/** 下注 */
export const placeBet = async (
  tableId: string,
  gameNumber: number,
  direction: '庄' | '闲',
  amount: number,
) => {
  return api.post('/games/bet', {
    table_id: tableId,
    game_number: gameNumber,
    direction,
    amount,
  });
};

/** 开奖 - 输入结果，触发结算和下一局分析 */
export const revealGame = async (
  tableId: string,
  gameNumber: number,
  result: '庄' | '闲' | '和',
) => {
  return api.post<RevealResponse>('/games/reveal', {
    table_id: tableId,
    game_number: gameNumber,
    result,
  });
};

/** 获取当前游戏状态（内存态） */
export const getCurrentGameState = async (tableId: string) => {
  return api.get<CurrentGameState>('/games/current-state', { params: { table_id: tableId } });
};

// ====== 开奖记录 ======

export const getGameRecords = async (params: {
  table_id: string;
  boot_number?: number;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: string;
}) => {
  return api.get('/games', { params });
};

// ====== 下注记录 ======

export const getBetRecords = async (params: {
  table_id: string;
  boot_number?: number;
  page?: number;
  page_size?: number;
}) => {
  return api.get('/bets', { params });
};

// ====== 系统日志 ======

export const getLogs = async (params: {
  table_id: string;
  category?: string;
  priority?: string;
  game_number?: number;
  page?: number;
  page_size?: number;
}) => {
  return api.get('/logs', { params });
};

// ====== 统计 ======

export const getStatistics = async (tableId: string) => {
  return api.get('/stats', { params: { table_id: tableId } });
};

// ====== 管理员 ======

export const adminLogin = async (username: string, password: string) => {
  return api.post('/admin/login', { username, password });
};

export const changePassword = async (oldPassword: string, newPassword: string) => {
  return api.post('/admin/change-password', { old_password: oldPassword, new_password: newPassword });
};

export const getModelVersions = async () => {
  return api.get('/admin/model-versions');
};

export const getDatabaseRecords = async (tableName: string, page: number = 1, pageSize: number = 50) => {
  return api.get('/admin/database-records', { params: { table_name: tableName, page, page_size: pageSize } });
};

// ====== 走势图 API ======

export interface RoadPointData {
  game_number: number;
  column: number;
  row: number;
  value: string;
  is_new_column: boolean;
  error_id: string | null;
}

export interface SingleRoadData {
  display_name: string;
  max_columns: number;
  max_rows: number;
  points: RoadPointData[];
}

export interface FiveRoadsResponse {
  table_id: string;
  boot_number: number | null;
  total_games: number;
  roads: {
    '大路': SingleRoadData;
    '珠盘路': SingleRoadData;
    '大眼仔路': SingleRoadData;
    '小路': SingleRoadData;
    '螳螂路': SingleRoadData;
  };
}

export const getRoadMaps = async (tableId: string, bootNumber?: number) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: Record<string, any> = { table_id: tableId };
  if (bootNumber !== undefined) params.boot_number = bootNumber;
  return api.get('/roads', { params });
};

export const getRoadRawData = async (tableId: string, bootNumber?: number) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: Record<string, any> = { table_id: tableId };
  if (bootNumber !== undefined) params.boot_number = bootNumber;
  return api.get('/roads/raw', { params });
};

// ====== WebSocket（带可选token认证）======

export const createWebSocket = (tableId: string): WebSocket => {
  const token = getToken();
  const wsUrl = import.meta.env.VITE_WS_URL || `ws://localhost:8000/ws/${tableId}`;
  const urlWithToken = token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl;
  return new WebSocket(urlWithToken);
};

// ====== AI模型分析 ======

export interface LatestAnalysis {
  table_id: string;
  banker_model: { summary: string | null; time: string | null };
  player_model: { summary: string | null; time: string | null };
  combined_model: { summary: string | null; confidence: number | null; bet_tier: string | null; prediction: string | null; time: string | null };
  has_data: boolean;
}

export const getLatestAnalysis = async (tableId: string) => {
  return api.get<LatestAnalysis>('/analysis/latest', { params: { table_id: tableId } });
};

// ====== 错题本 ======

export interface MistakeRecord {
  id?: number;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  road_snapshot: any | null;
  analysis: string | null;
  correction: string | null;
  created_at?: string;
}

export const getMistakeRecords = async (params: {
  table_id: string;
  boot_number?: number;
  page?: number;
  page_size?: number;
}) => {
  return api.get('/admin/database-records', { params: { ...params, table_name: 'mistake_book' } });
};

// ====== AI 学习控制 ======

export interface AILearningStatus {
  is_learning: boolean;
  current_task: string | null;
  min_samples: number;
  max_versions: number;
}

/** 启动AI学习（需管理员认证） */
export const startAiLearning = async (tableId: string, bootNumber: number) => {
  return api.post('/admin/ai-learning/start', null, {
    params: { table_id: tableId, boot_number: bootNumber },
  });
};

/** 获取AI学习状态（需管理员认证） */
export const getAiLearningStatus = async () => {
  return api.get<AILearningStatus>('/admin/ai-learning/status');
};

// ====== 三模型状态 ======

export interface ThreeModelStatus {
  status: 'ready' | 'incomplete';
  all_api_keys_configured: boolean;
  models: {
    banker: { name: string; provider: string; model: string; api_key_set: boolean; role: string };
    player: { name: string; provider: string; model: string; api_key_set: boolean; role: string };
    combined: { name: string; provider: string; model: string; api_key_set: boolean; role: string };
  };
  smart_router_enabled: boolean;
  fallback_policy: string;
}

/** 获取三模型配置和状态（需管理员认证） */
export const getThreeModelStatus = async () => {
  return api.get<ThreeModelStatus>('/admin/three-model-status');
};

export default api;
