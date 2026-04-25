/**
 * API 服务层 - 百家乐分析预测系统（手动模式）
 * 含 JWT 认证拦截器 + WebSocket 认证
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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

// ====== 响应拦截器：统一处理错误 ======
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 优先提取后端返回的详细错误信息 (FastAPI 默认在 detail 字段中)
    if (error.response?.data?.detail) {
      const detail = error.response.data.detail;
      // 处理 detail 可能是数组的情况（FastAPI 的 Pydantic 验证错误）
      error.message = Array.isArray(detail) 
        ? detail.map(e => e.msg || '验证错误').join(', ') 
        : detail;
    } else if (error.response?.status === 403) {
      error.message = '拒绝访问 (403)';
    } else if (error.response?.status === 404) {
      error.message = '请求的资源不存在 (404)';
    } else if (error.response?.status === 500) {
      error.message = '服务器内部错误 (500)';
    }

    if (error.response?.status === 401) {
      clearToken();
      // 只在非登录页面且非首页（上传页弹窗）时跳转，防止弹窗显示错误信息前被强制刷新
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/start') && currentPath !== '/') {
        console.warn('认证失败(401)，请重新登录');
        window.location.href = '/?session_expired=true';
      }
    }
    
    // 处理网络连接错误 (axios 内部默认英文信息)
    if (error.message === 'Network Error') {
      error.message = '网络连接失败，请检查后端服务是否正常运行';
    }
    if (error.code === 'ECONNABORTED') {
      error.message = '请求超时，请重试';
    }

    // 提取后端返回的具体错误信息并替换掉默认的英文提示
    if (error.response?.data?.detail) {
      error.message = error.response.data.detail;
    } else if (error.response?.status) {
      const statusMap: Record<number, string> = {
        400: '请求参数错误',
        401: '密码错误或登录已过期',
        403: '拒绝访问，权限不足或账户被锁定',
        404: '请求的资源不存在',
        500: '服务器内部错误',
        502: '网关错误',
        503: '服务不可用',
        504: '网关超时',
      };
      error.message = statusMap[error.response.status] || `请求失败 (${error.response.status})`;
    }

    return Promise.reject(error);
  },
);

// ====== 系统状态 ======

export const getSystemState = async () => {
  return api.get('/system/state', { params: { } });
};

export interface HealthScoreResponse {
  health_score: number;
  model_stability: number;
  settlement_consistency: number;
  status: 'healthy' | 'warning' | 'critical' | 'error';
  status_text: string;
  details: {
    ai_models: { score: number; max: number; issues: string[] };
    database: { score: number; max: number; issues: string[] };
    data_consistency: { score: number; max: number; issues: string[] };
    session_health: { score: number; max: number; issues: string[] };
  };
  all_issues: string[];
  timestamp: string;
}

export const getHealthScore = async (): Promise<HealthScoreResponse> => {
  return api.get('/system/health', { params: { } });
};

/** 后端健康检查（轻量ping） */
export const getSystemHealth = async () => {
  return api.get('/system/health', { params: { } });
};

export interface SystemDiagnosticsResponse {
  backend_version: string;
  openai_enabled: boolean;
  anthropic_enabled: boolean;
  gemini_enabled: boolean;
  db_ok: boolean;
  ws_connections: number;
  uptime_seconds: number;
  memory_sessions: string[];
}

/** 获取系统诊断信息（AI Key配置、DB状态、WS连接数等） */
export const getSystemDiagnostics = async () => {
  return api.get<SystemDiagnosticsResponse>('/system/diagnostics', { params: { } });
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

/** 手动上传批量开奖记录（最多72局），上传后自动触发AI分析 */
export const uploadGameResults = async (
  games: GameUploadItem[],
  isNewBoot?: boolean,
) => {
  return api.post<UploadResponse>('/games/upload', {
    games,
    is_new_boot: isNewBoot,
  });
};

/** 下注 */
export const placeBet = async (
  gameNumber: number,
  direction: '庄' | '闲',
  amount: number,
) => {
  return api.post('/games/bet', {
    game_number: gameNumber,
    direction,
    amount,
  });
};

/** 开奖 - 输入结果，触发结算和下一局分析 */
export const revealGame = async (
  gameNumber: number,
  result: '庄' | '闲' | '和',
) => {
  return api.post<RevealResponse>('/games/reveal', {
    game_number: gameNumber,
    result,
  });
};

/** 获取当前游戏状态（内存态） */
export const getCurrentGameState = async () => {
  return api.get<CurrentGameState>('/games/current-state', { params: { } });
};

/** 结束本靴 - 触发深度学习 */
export const endBoot = async () => {
  return api.post('/games/end-boot', null, { params: { } });
};

/** 获取深度学习状态 */
export const getDeepLearningStatus = async () => {
  return api.get('/games/deep-learning-status', { params: { } });
};

// ====== 开奖记录 ======

export const getGameRecords = async (params: {
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
  boot_number?: number;
  page?: number;
  page_size?: number;
}) => {
  return api.get('/bets', { params });
};

// ====== 系统日志 ======

export const getLogs = async (params: {
  category?: string;
  priority?: string;
  game_number?: number;
  page?: number;
  page_size?: number;
}) => {
  return api.get('/logs', { params });
};

// ====== 统计 ======

export const getStatistics = async () => {
  return api.get('/stats', { params: { } });
};

// ====== 管理员 ======

export const adminLogin = async (password: string) => {
  return api.post('/admin/login', { password });
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
  has_tie?: boolean;
  is_tie?: boolean;
}

export interface SingleRoadData {
  display_name: string;
  max_columns: number;
  max_rows: number;
  points: RoadPointData[];
}

export interface FiveRoadsResponse {
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

export const getRoadMaps = async (bootNumber?: number) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: Record<string, any> = { };
  if (bootNumber !== undefined) params.boot_number = bootNumber;
  return api.get('/roads', { params });
};

export const getRoadRawData = async (bootNumber?: number) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: Record<string, any> = { };
  if (bootNumber !== undefined) params.boot_number = bootNumber;
  return api.get('/roads/raw', { params });
};

// ====== WebSocket（带可选token认证）======

export const createWebSocket = (): WebSocket => {
  const token = getToken();
  
  // 智能推断 WebSocket URL：
  // 1. 如果配置了 VITE_WS_URL，直接使用
  // 2. 如果在开发环境或没有配置，根据当前页面地址自动生成 ws(s)://host:port/ws
  let baseWsUrl = import.meta.env.VITE_WS_URL;
  if (!baseWsUrl) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // 包含端口
    baseWsUrl = `${protocol}//${host}`;
  }

  const wsUrl = baseWsUrl.includes('/ws')
    ? baseWsUrl
    : `${baseWsUrl}/ws`;
    
  const urlWithToken = token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl;
  return new WebSocket(urlWithToken);
};

// ====== AI模型分析 ======

export interface LatestAnalysis {
  banker_model: { summary: string | null; time: string | null };
  player_model: { summary: string | null; time: string | null };
  combined_model: { summary: string | null; confidence: number | null; bet_tier: string | null; prediction: string | null; time: string | null };
  has_data: boolean;
}

export const getLatestAnalysis = async () => {
  return api.get<LatestAnalysis>('/analysis/latest', { params: { } });
};

// ====== 错题本 ======

// MistakeRecord 类型定义已移至 useQueries.ts，请从那里导入
// 保留此导出以避免破坏现有导入，但标记为 deprecated
/** @deprecated 请从 useQueries.ts 导入 MistakeRecord */
export type MistakeRecord = import('../hooks/useQueries').MistakeRecord;

export const getMistakeRecords = async (params: {
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
export const startAiLearning = async (bootNumber: number) => {
  return api.post('/admin/ai-learning/start', null, {
    params: { boot_number: bootNumber },
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
    banker: { name: string; provider: string; model: string; api_key_set: boolean; role: string; base_url?: string };
    player: { name: string; provider: string; model: string; api_key_set: boolean; role: string; base_url?: string };
    combined: { name: string; provider: string; model: string; api_key_set: boolean; role: string; base_url?: string };
  };
  smart_router_enabled: boolean;
  fallback_policy: string;
}

export interface ApiConfigPayload {
  role: 'banker' | 'player' | 'combined';
  provider: string;
  model: string;
  api_key: string;
  base_url?: string;
}

/** 获取三模型配置和状态（需管理员认证） */
export const getThreeModelStatus = async () => {
  return api.get<ThreeModelStatus>('/admin/three-model-status');
};

/** 更新模型API配置 */
export const updateApiConfig = async (payload: ApiConfigPayload) => {
  return api.post('/admin/api-config', payload);
};

/** 测试模型连通性 */
export const testApiConnection = async (payload: ApiConfigPayload) => {
  return api.post('/admin/api-config/test', payload);
};

export const updatePredictionMode = async (mode: 'ai' | 'rule') => {
  return api.post('/system/prediction-mode', { mode });
};

export const adjustBalance = async (payload: { action: 'add' | 'sub'; amount: number }) => {
  return api.post('/system/balance', payload);
};

export default api;
