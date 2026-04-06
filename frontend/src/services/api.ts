/**
 * API 服务层 - 百家乐分析预测系统
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
  timeout: 10000,
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
      // token无效或过期，清除并提示重新登录
      clearToken();
      console.warn('认证失败(401)，请重新登录');
    }
    return Promise.reject(error);
  },
);

// ====== 系统控制 ======

export const startSystem = async (tableId: string) => {
  return api.post('/system/start', { table_id: tableId });
};

export const stopSystem = async (tableId: string) => {
  return api.post('/system/stop', null, { params: { table_id: tableId } });
};

export const getSystemState = async (tableId: string) => {
  return api.get('/system/state', { params: { table_id: tableId } });
};

export const getHealthScore = async (tableId: string) => {
  return api.get('/system/health', { params: { table_id: tableId } });
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

// ====== 实盘日志 ======

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
  const params: Record<string, any> = { table_id: tableId };
  if (bootNumber !== undefined) params.boot_number = bootNumber;
  return api.get('/roads', { params });
};

export const getRoadRawData = async (tableId: string, bootNumber?: number) => {
  const params: Record<string, any> = { table_id: tableId };
  if (bootNumber !== undefined) params.boot_number = bootNumber;
  return api.get('/roads/raw', { params });
};

// ====== WebSocket（带可选token认证）======

export const createWebSocket = (tableId: string): WebSocket => {
  const token = getToken();
  const wsUrl = import.meta.env.VITE_WS_URL || `ws://localhost:8000/ws/${tableId}`;
  // 有token则附加到URL查询参数
  const urlWithToken = token ? `${wsUrl}?token=${encodeURIComponent(token)}` : wsUrl;
  const ws = new WebSocket(urlWithToken);
  return ws;
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

// ====== 采集控制 ======

export interface CrawlerStatus {
  table_id: string;
  type: string;
  url: string;
  last_game_number: number;
  stability_score: number;
  total_calls: number;
  success_rate: number;
  cached_count?: number;
  desk_id?: string;
  status?: string;
  message?: string;
}

export interface CrawlerTestResult {
  success: boolean;
  data: {
    game_number: number | null;
    result: string | null;
    raw_data: any;
  } | null;
  source: string;
  crawl_time: number;
  error: string | null;
}

export interface CrawlerRawData {
  table_id: string;
  total: number;
  data: any[];
}

export const getCrawlerStatus = async (tableId: string) => {
  return api.get<CrawlerStatus>('/crawler/status', { params: { table_id: tableId } });
};

export const testCrawler = async (tableId: string) => {
  return api.post<CrawlerTestResult>('/crawler/test', null, { params: { table_id: tableId } });
};

export const getCrawlerRawData = async (tableId: string) => {
  return api.get<CrawlerRawData>('/crawler/raw-data', { params: { table_id: tableId } });
};

export default api;
