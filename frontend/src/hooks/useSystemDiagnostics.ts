/**
 * 系统诊断 Hook
 * 实时监控：实时推送连接状态、后端服务、AI模型状态、错误告警
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../services/api';
import { wsBus } from '../services/wsBus';

// ====== 类型定义 ======

export type ServiceStatus = 'online' | 'offline' | 'degraded' | 'unknown';
export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export interface AIModelStatus {
  name: string;
  key: 'openai' | 'anthropic' | 'gemini' | 'single_ai';
  label: string;
  status: 'ok' | 'error' | 'unconfigured' | 'unknown';
  message?: string;
  required?: boolean;
  provider?: string;
  model?: string | null;
}

export interface SystemDiagnostics {
  // 实时推送
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
  currentMode?: 'ai' | 'single_ai' | 'rule';
  modeReadiness?: Record<string, { required: string[]; configured_count: number; missing: string[]; status: string }>;

  // 当前活跃问题
  activeIssues: SystemIssue[];
  criticalIssueCount: number;

  // 系统整体健康
  overallHealth: 'healthy' | 'warning' | 'critical' | 'unknown';

  // 后台任务摘要
  backgroundTasks: {
    runningCount: number;
    runningTypes: string[];
    latestErrors: Array<Record<string, unknown>>;
  };
}

export interface SystemIssue {
  id: string;
  level: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  time: Date;
  source: 'websocket' | 'backend' | 'ai_current' | 'ai_other' | 'data' | 'system';
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
    { name: '庄模型接口', key: 'openai', label: '庄模型', status: 'unknown' },
    { name: '闲模型接口', key: 'anthropic', label: '闲模型', status: 'unknown' },
    { name: '综合模型接口', key: 'gemini', label: '综合模型', status: 'unknown' },
  ]);
  const [currentMode, setCurrentMode] = useState<SystemDiagnostics['currentMode']>(undefined);
  const [modeReadiness, setModeReadiness] = useState<SystemDiagnostics['modeReadiness']>(undefined);

  const [activeIssues, setActiveIssues] = useState<SystemIssue[]>([]);
  const [backgroundTasks, setBackgroundTasks] = useState<SystemDiagnostics['backgroundTasks']>({
    runningCount: 0,
    runningTypes: [],
    latestErrors: [],
  });

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

  useEffect(() => {
    if (!enabled) return;
    isUnmountedRef.current = false;

    const unsub = wsBus.subscribeMeta((meta) => {
      if (isUnmountedRef.current) return;

      const token = api.getToken();
      if (!token) {
        setWsStatus('disconnected');
        setWsLatency(null);
        setWsLastMessage(null);
        setWsReconnectCount(0);
        removeIssueBySource('websocket');
        return;
      }

      setWsLatency(meta.latencyMs);
      setWsLastMessage(meta.lastMessageAt);
      setWsReconnectCount(meta.reconnectCount);

      if (meta.connectionState === 'open') {
        setWsStatus('connected');
        removeIssueBySource('websocket');
        return;
      }

      if (meta.reconnecting) {
        setWsStatus('reconnecting');
        addIssue({
          level: 'warning',
          title: '实时推送已断线',
          detail: '实时推送断线，正在重连...',
          source: 'websocket',
        });
        return;
      }

      if (meta.connectionState === 'connecting') {
        setWsStatus('connecting');
        return;
      }

      setWsStatus('disconnected');
      addIssue({
        level: 'critical',
        title: '实时推送连接错误',
        detail: '无法建立实时推送连接，请检查后端服务是否运行',
        source: 'websocket',
      });
    });

    return () => {
      isUnmountedRef.current = true;
      unsub();
    };
  }, [enabled, addIssue, removeIssueBySource]);

  // ====== 后端健康检查（每15秒） ======
  const checkBackend = useCallback(async () => {
    if (isUnmountedRef.current) return;
    const start = Date.now();
    try {
      await api.getSystemPing();
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
          detail: `后端接口响应延迟 ${latency}毫秒，可能影响使用体验`,
          source: 'backend',
        });
      }
    } catch {
      setBackendStatus('offline');
      setLastBackendCheck(new Date());
      addIssue({
        level: 'critical',
        title: '后端服务离线',
        detail: '无法连接后端API（/api），请确认后端服务已启动',
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
      if (!api.getToken()) {
        removeIssueBySource('ai_current');
        removeIssueBySource('ai_other');
        setCurrentMode(undefined);
        setModeReadiness(undefined);
        setAiModels([
          { name: '庄模型接口', key: 'openai', label: '庄模型', status: 'unknown' },
          { name: '闲模型接口', key: 'anthropic', label: '闲模型', status: 'unknown' },
          { name: '综合模型接口', key: 'gemini', label: '综合模型', status: 'unknown' },
        ]);
        setBackgroundTasks({ runningCount: 0, runningTypes: [], latestErrors: [] });
        return;
      }
      try {
        const res = await api.getSystemDiagnostics();
        if (isUnmountedRef.current) return;
        
        const diag = res.data;
        if (!diag) return;

        const newModels: AIModelStatus[] = Array.isArray(diag.models) && diag.models.length > 0
          ? diag.models.map((m) => ({
            name: `${m.label}接口`,
            key: m.key,
            label: m.label,
            status: m.enabled ? 'ok' : 'unconfigured',
            message: m.enabled ? undefined : (m.issue || '接口密钥未配置'),
            required: !!m.required_in_current_mode,
            provider: m.provider,
            model: m.model ?? null,
          }))
          : [
            {
              name: '庄模型接口',
              key: 'openai',
              label: '庄模型',
              status: diag.openai_enabled ? 'ok' : 'unconfigured',
              message: diag.openai_enabled ? undefined : '接口密钥未配置',
              required: true,
              provider: 'openai',
              model: null,
            },
            {
              name: '闲模型接口',
              key: 'anthropic',
              label: '闲模型',
              status: diag.anthropic_enabled ? 'ok' : 'unconfigured',
              message: diag.anthropic_enabled ? undefined : '接口密钥未配置',
              required: true,
              provider: 'anthropic',
              model: null,
            },
            {
              name: '综合模型接口',
              key: 'gemini',
              label: '综合模型',
              status: diag.gemini_enabled ? 'ok' : 'unconfigured',
              message: diag.gemini_enabled ? undefined : '接口密钥未配置',
              required: true,
              provider: 'gemini',
              model: null,
            },
          ];

        // 使用setTimeout避免同步setState
        activeTimeout = setTimeout(() => {
          if (isUnmountedRef.current) return;
          setCurrentMode(diag.current_mode);
          setModeReadiness(diag.mode_readiness);
          setAiModels(newModels);
          const bg = diag.background_tasks;
          if (bg) {
            setBackgroundTasks({
              runningCount: bg.running_count || 0,
              runningTypes: bg.running_types || [],
              latestErrors: bg.latest_errors || [],
            });
          } else {
            setBackgroundTasks({ runningCount: 0, runningTypes: [], latestErrors: [] });
          }

          const currentIssues = Array.isArray(diag.issues_current_mode) ? diag.issues_current_mode : [];
          const otherIssues = Array.isArray(diag.issues_other_modes) ? diag.issues_other_modes : [];
          if (currentIssues.length > 0) {
            const severityRank: Record<string, number> = { critical: 3, warning: 2, info: 1 };
            const top = [...currentIssues].sort((a, b) => (severityRank[b.level] || 0) - (severityRank[a.level] || 0))[0];
            addIssue({
              level: top.level === 'critical' ? 'critical' : top.level === 'warning' ? 'warning' : 'info',
              title: top.title,
              detail: top.detail,
              source: 'ai_current',
            });
          } else {
            removeIssueBySource('ai_current');
          }

          if (otherIssues.length > 0) {
            addIssue({
              level: 'info',
              title: otherIssues[0].title,
              detail: otherIssues[0].detail,
              source: 'ai_other',
            });
          } else {
            removeIssueBySource('ai_other');
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
  const requiredModels = aiModels.filter(m => m.required !== false);
  const aiAnyOk = requiredModels.some(m => m.status === 'ok');
  const aiAllOk = requiredModels.length > 0 ? requiredModels.every(m => m.status === 'ok') : true;
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
    currentMode,
    modeReadiness,
    activeIssues,
    criticalIssueCount,
    overallHealth,
    backgroundTasks,
  };

  const dismissIssue = useCallback((id: string) => {
    setActiveIssues(prev => prev.filter(i => i.id !== id));
  }, []);

  const retryConnection = useCallback(() => {
    wsBus.reconnectNow();
    checkBackend();
  }, [checkBackend]);

  return { diagnostics, dismissIssue, retryConnection, addIssue };
};

export default useSystemDiagnostics;
