/**
 * API 服务层 - 百家乐分析预测系统
 */
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

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

// ====== WebSocket ======

export const createWebSocket = (tableId: string): WebSocket => {
  const ws = new WebSocket(`ws://localhost:8000/ws/${tableId}`);
  return ws;
};

export default api;
