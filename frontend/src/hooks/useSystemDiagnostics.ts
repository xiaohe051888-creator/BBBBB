/**
 * 系统诊断 Hook
 * 实时监控：WebSocket连接状态、后端服务、AI模型状态、错误告警
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../services/api';

// ====== 类型定义 ======

export type ServiceStatus = 'online' | 'offline' | 'degraded' | 'unknown';
export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface AIModelStatus {
  name: string;
  key: 'openai' | 'anthropic' | 'gemini';
  label: string;
  status: 'ok' | 'error' | 'unconfigured' | 'unknown';
  message?: string;
}

export interface SystemDiagnostics {
  // WebSocket
  wsStatus: WsStatus;
  wsLatency: number | null;          // ms
  wsLastMessage: Date | null;
  wsReconnectCount: number;

  // 后端服务
  backendStatus: ServiceStatus;
  backendLatency: number | null;     // ms
  lastBackendCheck: Date | null;

  // AI模型状态
  aiModels: AIModelStatus[];
  aiAnyOk: boolean;
  aiAllOk: boolean;

  // 当前活跃问题
  activeIssues: SystemIssue[];
  criticalIssueCount: number;

  // 系统整体健康
  overallHealth: 'healthy' | 'warning' | 'critical' | 'unknown';
}

export interface SystemIssue {
  id: string;
  level: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  time: Date;
  source: 'websocket' | 'backend' | 'ai' | 'data' | 'system';
}

interface UseSystemDiagnosticsOptions {
  enabled?: boolean;
}

/**
 * 系统诊断 Hook - 实时监控所有系统状态
 */
export const useSystemDiagnostics = (options: UseSystemDiagnosticsOptions) => {
  const { enabled = true } = options;

  const [wsStatus, setWsStatus] = useState<WsStatus>('connecting');
  const [wsLatency, setWsLatency] = useState<number | null>(null);
  const [wsLastMessage, setWsLastMessage] = useState<Date | null>(null);
  const [wsReconnectCount, setWsReconnectCount] = useState(0);

  const [backendStatus, setBackendStatus] = useState<ServiceStatus>('unknown');
  const [backendLatency, setBackendLatency] = useState<number | null>(null);
  const [lastBackendCheck, setLastBackendCheck] = useState<Date | null>(null);

  const [aiModels, setAiModels] = useState<AIModelStatus[]>([
    { name: 'OpenAI GPT-4o', key: 'openai', label: '庄模型', status: 'unknown' },
    { name: 'Claude Sonnet', key: 'anthropic', label: '闲模型', status: 'unknown' },
    { name: 'Gemini Flash', key: 'gemini', label: '综合模型', status: 'unknown' },
  ]);

  const [activeIssues, setActiveIssues] = useState<SystemIssue[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingTimeRef = useRef<number | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);

  // ====== 辅助：添加活跃问题 ======
  const addIssue = useCallback((issue: Omit<SystemIssue, 'id' | 'time'>) => {
    const newIssue: SystemIssue = {
      ...issue,
      id: `${issue.source}-${issue.level}-${Date.now()}`,
      time: new Date(),
    };
    setActiveIssues(prev => {
      // 避免重复：同source+level+title的问题只保留最新一条
      const filtered = prev.filter(p => !(p.source === issue.source && p.level === issue.level && p.title === issue.title));
      return [newIssue, ...filtered].slice(0, 20);
    });
  }, []);

  const removeIssueBySource = useCallback((source: SystemIssue['source']) => {
    setActiveIssues(prev => prev.filter(p => p.source !== source));
  }, []);

  // ====== WebSocket 监控 ======
  // 使用ref存储connectWS函数，避免循环依赖问题
  const connectWSRef = useRef<(() => void) | null>(null);

  const connectWS = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (!enabled) return;

    setWsStatus('connecting');

    try {
      const ws = api.createWebSocket();
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) return;
        setWsStatus('connected');
        removeIssueBySource('websocket');
      };

      ws.onmessage = (event) => {
        if (isUnmountedRef.current) return;
        setWsLastMessage(new Date());

        // 处理pong消息（计算延迟）
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong' && pingTimeRef.current !== null) {
            const latency = Date.now() - pingTimeRef.current;
            setWsLatency(latency);
            pingTimeRef.current = null;
          }
        } catch {
          // 非JSON消息，忽略
        }
      };

      ws.onerror = () => {
        if (isUnmountedRef.current) return;
        setWsStatus('disconnected');
        addIssue({
          level: 'critical',
          title: 'WebSocket连接错误',
          detail: '实时推送连接发生错误，数据可能延迟',
          source: 'websocket',
        });
      };

      ws.onclose = () => {
        if (isUnmountedRef.current) return;
        setWsStatus('reconnecting');
        addIssue({
          level: 'warning',
          title: 'WebSocket已断线',
          detail: '实时推送断线，正在重连（3秒后重试）...',
          source: 'websocket',
        });
        setWsReconnectCount(c => c + 1);
        reconnectTimerRef.current = setTimeout(() => {
          if (!isUnmountedRef.current && connectWSRef.current) {
            connectWSRef.current();
          }
        }, 3000);
      };

      // 定时ping（每10秒）
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          pingTimeRef.current = Date.now();
          try {
            ws.send(JSON.stringify({ type: 'ping' }));
          } catch {
            // 发送失败，忽略
          }
        }
      }, 10000);

    } catch {
      if (!isUnmountedRef.current) {
        setWsStatus('disconnected');
        addIssue({
          level: 'critical',
          title: 'WebSocket无法创建',
          detail: '无法建立实时推送连接，请检查后端服务是否运行',
          source: 'websocket',
        });
        reconnectTimerRef.current = setTimeout(() => {
          if (!isUnmountedRef.current && connectWSRef.current) {
            connectWSRef.current();
          }
        }, 5000);
      }
    }
  }, [enabled, addIssue, removeIssueBySource]);

  // 使用useEffect更新ref，避免在渲染期间修改
  useEffect(() => {
    connectWSRef.current = connectWS;
  }, [connectWS]);

  useEffect(() => {
    if (!enabled) return;
    isUnmountedRef.current = false;
    // 使用setTimeout避免在渲染期间同步调用
    const timer = setTimeout(() => {
      if (connectWSRef.current) {
        connectWSRef.current();
      }
    }, 0);

    return () => {
      isUnmountedRef.current = true;
      clearTimeout(timer);
      if (pingTimerRef.current) clearInterval(pingTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled]);

  // ====== 后端健康检查（每15秒） ======
  const checkBackend = useCallback(async () => {
    if (isUnmountedRef.current) return;
    const start = Date.now();
    try {
      await api.getSystemHealth();
      const latency = Date.now() - start;
      setBackendStatus('online');
      setBackendLatency(latency);
      setLastBackendCheck(new Date());
      removeIssueBySource('backend');

      // 延迟高于500ms降级
      if (latency > 500) {
        setBackendStatus('degraded');
        addIssue({
          level: 'warning',
          title: '后端响应缓慢',
          detail: `后端API响应延迟 ${latency}ms，可能影响使用体验`,
          source: 'backend',
        });
      }
    } catch {
      setBackendStatus('offline');
      setLastBackendCheck(new Date());
      addIssue({
        level: 'critical',
        title: '后端服务离线',
        detail: '无法连接后端API（http://localhost:8000），请确认后端服务已启动',
        source: 'backend',
      });
    }
  }, [addIssue, removeIssueBySource]);

  useEffect(() => {
    if (!enabled) return;
    
    let timer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const runCheck = async () => {
      if (!isMounted || isUnmountedRef.current) return;
      await checkBackend();
      if (isMounted && !isUnmountedRef.current) {
        timer = setTimeout(runCheck, 15000);
      }
    };

    timer = setTimeout(runCheck, 0);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, checkBackend]);

  // ====== AI模型状态检查（通过诊断API，每30秒） ======
  useEffect(() => {
    if (!enabled) return;

    let activeTimeout: ReturnType<typeof setTimeout> | null = null;

    const checkAI = async () => {
      if (isUnmountedRef.current) return;
      try {
        const res = await api.getSystemDiagnostics();
        if (isUnmountedRef.current) return;
        
        const diag = res.data;
        if (!diag) return;

        const newModels: AIModelStatus[] = [
          {
            name: 'OpenAI GPT-4o mini',
            key: 'openai',
            label: '庄模型',
            status: diag.openai_enabled ? 'ok' : 'unconfigured',
            message: diag.openai_enabled ? undefined : 'OPENAI_API_KEY 未配置',
          },
          {
            name: 'Claude Sonnet',
            key: 'anthropic',
            label: '闲模型',
            status: diag.anthropic_enabled ? 'ok' : 'unconfigured',
            message: diag.anthropic_enabled ? undefined : 'ANTHROPIC_API_KEY 未配置',
          },
          {
            name: 'Gemini Flash',
            key: 'gemini',
            label: '综合模型',
            status: diag.gemini_enabled ? 'ok' : 'unconfigured',
            message: diag.gemini_enabled ? undefined : 'GEMINI_API_KEY 未配置',
          },
        ];

        // 使用setTimeout避免同步setState
        activeTimeout = setTimeout(() => {
          if (isUnmountedRef.current) return;
          setAiModels(newModels);

          // 检查是否有AI模型问题
          const unconfigured = newModels.filter(m => m.status === 'unconfigured');
          if (unconfigured.length === 3) {
            addIssue({
              level: 'critical',
              title: '所有AI模型均未配置',
              detail: 'OpenAI / Claude / Gemini API Key 均未配置，无法进行AI分析预测',
              source: 'ai',
            });
          } else if (unconfigured.length > 0) {
            addIssue({
              level: 'warning',
              title: `${unconfigured.length}个AI模型未配置`,
              detail: unconfigured.map(m => `${m.label}(${m.name}): ${m.message}`).join('；'),
              source: 'ai',
            });
          } else {
            removeIssueBySource('ai');
          }
        }, 0);

      } catch (err) {
        console.error('[SystemDiagnostics] AI诊断失败:', err);
      }
    };

    // 包装为一个递归调度的函数
    let isMounted = true;
    let loopTimer: ReturnType<typeof setTimeout> | null = null;
    
    const runAIAndSchedule = async () => {
      if (!isMounted || isUnmountedRef.current) return;
      await checkAI(); // 等待请求和状态处理完成
      if (isMounted && !isUnmountedRef.current) {
        loopTimer = setTimeout(runAIAndSchedule, 30000); // 调度下一次检查
      }
    };

    loopTimer = setTimeout(runAIAndSchedule, 0);

    return () => {
      isMounted = false;
      if (loopTimer) clearTimeout(loopTimer);
      if (activeTimeout) clearTimeout(activeTimeout);
    };
  }, [enabled, addIssue, removeIssueBySource]);

  // ====== 计算衍生状态 ======
  const aiAnyOk = aiModels.some(m => m.status === 'ok');
  const aiAllOk = aiModels.every(m => m.status === 'ok');
  const criticalIssueCount = activeIssues.filter(i => i.level === 'critical').length;

  const overallHealth: SystemDiagnostics['overallHealth'] = (() => {
    if (backendStatus === 'offline') return 'critical';
    if (wsStatus === 'disconnected') return 'critical';
    if (criticalIssueCount > 0) return 'critical';
    if (activeIssues.some(i => i.level === 'warning')) return 'warning';
    if (backendStatus === 'degraded' || wsStatus === 'reconnecting') return 'warning';
    if (backendStatus === 'online' && wsStatus === 'connected') return 'healthy';
    return 'unknown';
  })();

  const diagnostics: SystemDiagnostics = {
    wsStatus,
    wsLatency,
    wsLastMessage,
    wsReconnectCount,
    backendStatus,
    backendLatency,
    lastBackendCheck,
    aiModels,
    aiAnyOk,
    aiAllOk,
    activeIssues,
    criticalIssueCount,
    overallHealth,
  };

  const dismissIssue = useCallback((id: string) => {
    setActiveIssues(prev => prev.filter(i => i.id !== id));
  }, []);

  const retryConnection = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    connectWS();
    checkBackend();
  }, [connectWS, checkBackend]);

  return { diagnostics, dismissIssue, retryConnection, addIssue };
};

export default useSystemDiagnostics;
