/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 管理员页面 - AI学习 & 数据库查看（手动模式）
 * 移除爬虫相关功能，专注AI模型管理和数据查看
 * 优化：精致图标、自适应布局、中文全站
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Card, Button, Table, Tag, Space, Input, Modal, App, Grid,
  Select, Tabs, Empty, Statistic, Row, Col
} from 'antd';
import dayjs from 'dayjs';
import * as api from '../services/api';
import { clearToken } from '../services/api';
import { copyText } from '../utils/clipboard';
import { formatMoney } from '../utils/money';
import { toCnModelLabel, toCnProviderLabel } from '../utils/i18nErrors';
import { useSystemDiagnostics } from '../hooks/useSystemDiagnostics';
import { useSystemStateQuery } from '../hooks/useQueries';
import { StartLearningModal } from '../components/dashboard/StartLearningModal';
import { ApiConfigModal } from '../components/admin/ApiConfigModal';
import { shouldCloseApiConfigModalAfterSave } from '../components/admin/apiConfigFlow';
import { useQueryClient } from '@tanstack/react-query';

// 精致图标组件
const Icons = {
  Back: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
  ),
  AI: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  ),
  Database: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  ),
  Key: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </svg>
  ),
  Trend: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
    </svg>
  ),
  Robot: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  Close: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  ),
  Logout: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
    </svg>
  ),
  Experiment: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.8 18.4L14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4c-.49.66-.02 1.6.8 1.6h14c.82 0 1.29-.94.8-1.6z"/>
    </svg>
  ),
  Banker: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff4d4f">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  Player: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1890ff">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  Brain: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#52c41a">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  ),
};

const MODE_LABELS: Record<'ai' | 'single_ai' | 'rule', string> = {
  ai: '3AI模式',
  single_ai: '单AI模式',
  rule: '规则引擎模式',
};

const DEFAULT_SINGLE_AI_PREDICTION_TEMPLATE = `你是资深百家乐盘口分析员。任务：只预测下一局，且必须给出可执行下注建议。

硬约束：
1) 必须逐路分析当前靴完整五路：大路、珠盘路、大眼仔路、小路、螳螂路；每条路都不能漏。
2) 必须覆盖当前靴每一局历史，不能跳局、不能只看最近几局。
3) 每一局必须输出“庄”或“闲”二选一，不允许输出“观望/不下注/等待”。
4) 风险控制只能通过下注档位与金额调整，不得用“不下注”规避风险。
5) 先看五路特征摘要，再回看全量五路点位做交叉校验；若冲突，说明冲突来源并给出降级后的执行方案。

输入数据：
- 当前靴号：{{BOOT_NUMBER}}
- 当前局号：{{GAME_NUMBER}}
- 连续失准：{{CONSECUTIVE_ERRORS}}
- 历史对局：{{GAME_HISTORY}}
- 五路特征摘要：{{ROAD_FEATURES}}
- 五路原始数据：{{ROAD_DATA}}
- 最近失误上下文：{{MISTAKE_CONTEXT}}

请严格按以下 JSON 输出（不要输出任何多余文字）：
{
  "最终预测": "庄或闲",
  "置信度": 0.0,
  "下注档位": "激进|中等|保守",
  "风险分": 0.0,
  "摘要": "先给五路综合结论，再给逐路要点（大路/珠盘路/大眼仔/小路/螳螂路），最后给冲突处理",
  "推理要点": [
    "大路：一句话判断",
    "珠盘路：一句话判断",
    "大眼仔路：一句话判断",
    "小路：一句话判断",
    "螳螂路：一句话判断"
  ],
  "推理详情": "补充更完整的推理过程",
  "下一步操作": "一句可执行指令，必须可直接下注"
}`;

const DEFAULT_SINGLE_AI_REALTIME_STRATEGY_TEMPLATE = `你是老手盘口复盘员。任务：当前局已下注且等待开奖时，提炼“下一局可执行策略”。

硬约束：
1) 必须基于当前靴完整五路与完整逐局历史复盘，每条路都不能漏。
2) 不允许给“观望/不下注”建议；必须给下一局“庄/闲”方向倾向与资金节奏建议。
3) 连续失准越高，语气越保守，明确缩仓和风控动作，但仍保持可执行。
4) 结论要像实战盘口口吻：短句、明确、能落地。

输入数据：
- 连续失准：{{CONSECUTIVE_ERRORS}}
- 历史对局：{{GAME_HISTORY}}
- 五路特征摘要：{{ROAD_FEATURES}}
- 五路原始数据：{{ROAD_DATA}}

请严格按以下 JSON 输出（不要输出任何多余文字）：
{
  "盘口提示": "老手盘口提示（2-3句）",
  "走势总结": "五路一致性与冲突点总结",
  "下一局方向": "庄或闲",
  "置信度": 0.0,
  "下注档位建议": "激进|中等|保守",
  "资金建议": "一句资金管理建议（体现连错衰减）",
  "风险提醒": "一句风险提醒",
  "观察点": [
    "下一局开前先看哪条路是否延续",
    "若第一关键位反向，如何立即降级",
    "若一致性增强，如何小步跟进"
  ]
}`;

const isLegacyPromptTemplate = (value?: string | null): boolean =>
  /^(PRED|REAL)\b/i.test(String(value || '').trim());

const resolvePredictionTemplate = (value?: string | null): string => {
  const raw = String(value || '').trim();
  if (!raw || isLegacyPromptTemplate(raw)) return DEFAULT_SINGLE_AI_PREDICTION_TEMPLATE;
  return value || DEFAULT_SINGLE_AI_PREDICTION_TEMPLATE;
};

const resolveRealtimeStrategyTemplate = (value?: string | null): string => {
  const raw = String(value || '').trim();
  if (!raw || isLegacyPromptTemplate(raw)) return DEFAULT_SINGLE_AI_REALTIME_STRATEGY_TEMPLATE;
  return value || DEFAULT_SINGLE_AI_REALTIME_STRATEGY_TEMPLATE;
};

const getProviderModelSummary = (provider?: string | null, model?: string | null): string => {
  if (!provider && !model) return '尚未配置';
  return `${toCnProviderLabel(provider)} · ${toCnModelLabel(model)}`;
};

const withMobileTableLabels = (columns: any[]): any[] =>
  columns.map((col) => ({
    ...col,
    onCell: () => ({
      'data-label': typeof col.title === 'string' ? col.title : '',
    } as React.HTMLAttributes<HTMLElement>),
  }));

const AdminPage: React.FC = () => {
  const { message } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const token = (location.state as any)?.token || api.getToken();
  
  // 系统诊断（AdminPage使用默认桌号）
  const { addIssue } = useSystemDiagnostics({});
  
  // 未登录则重定向到首页
  React.useEffect(() => {
    if (!token) {
      navigate('/dashboard');
    }
  }, [token, navigate]);
  
  const [activeTab, setActiveTab] = useState('ai');
  const [modelVersions, setModelVersions] = useState<any[]>([]);
  const [modelVersionModeFilter, setModelVersionModeFilter] = useState<'all' | 'ai' | 'single_ai'>('all');
  const [dbRecords, setDbRecords] = useState<any[]>([]);
  const [dbTable, setDbTable] = useState('game_records');
  const [dbPage, setDbPage] = useState(1);
  const [maintenanceStats, setMaintenanceStats] = useState<api.AdminMaintenanceStatsResponse | null>(null);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [aiLearningStatus, setAiLearningStatus] = useState<any>(null);
  const [threeModelStatus, setThreeModelStatus] = useState<any>(null);
  const [systemTasks, setSystemTasks] = useState<api.BackgroundTaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [singleAiPromptLoading, setSingleAiPromptLoading] = useState(false);
  const [singleAiPromptSaving, setSingleAiPromptSaving] = useState(false);
  const [singleAiActiveVersion, setSingleAiActiveVersion] = useState<string | null>(null);
  const [singleAiPredictionTemplate, setSingleAiPredictionTemplate] = useState('');
  const [singleAiRealtimeStrategyTemplate, setSingleAiRealtimeStrategyTemplate] = useState('');

  // API配置弹窗
  const [apiConfigVisible, setApiConfigVisible] = useState(false);
  const [apiConfigRole, setApiConfigRole] = useState<'banker' | 'player' | 'combined' | 'single'>('banker');

  // 修改密码弹窗
  const [changePwdVisible, setChangePwdVisible] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');

  // 预测模式
  const [predictionMode, setPredictionMode] = useState<'ai' | 'single_ai' | 'rule'>('rule');
  const [updatingMode, setUpdatingMode] = useState(false);
  const [modePickerVisible, setModePickerVisible] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState<string>('');
  const [adjustingBalance, setAdjustingBalance] = useState(false);
  const { data: systemState } = useSystemStateQuery({});

  useEffect(() => {
    if (systemState?.prediction_mode) {
      setPredictionMode(systemState.prediction_mode);
    }
  }, [systemState?.prediction_mode]);

  const applyModeChange = async (newMode: 'ai' | 'single_ai' | 'rule') => {

    // 如果选择 AI 模式，但尚未配置至少一个大模型接口，则拦截并提示
    if (newMode === 'ai') {
      const isConfigured =
        !!threeModelStatus?.models?.banker?.api_key_set &&
        !!threeModelStatus?.models?.player?.api_key_set &&
        !!threeModelStatus?.models?.combined?.api_key_set;

      if (!isConfigured) {
        message.warning('无法切换至 3AI 模式：需先配置庄模型、闲模型、综合模型三项接口。');
        return;
      }
    }
    if (newMode === 'single_ai') {
      const isConfigured = threeModelStatus?.models?.single?.api_key_set;
      if (!isConfigured) {
        message.warning('无法切换至 单AI 模式：您尚未配置单AI模型接口。');
        return;
      }
    }

    setUpdatingMode(true);
    try {
      await api.updatePredictionMode(newMode);
      setPredictionMode(newMode);
      message.success(`已切换至${MODE_LABELS[newMode]}`);
    } catch (error: any) {
      message.error(error instanceof Error ? error.message : '切换模式失败');
    } finally {
      setUpdatingMode(false);
      queryClient.invalidateQueries({ queryKey: ['systemState'] });
    }
  };

  const handleBalanceAdjust = async (action: 'add' | 'sub') => {
    const amt = parseFloat(balanceAmount);
    if (isNaN(amt) || amt <= 0) {
      message.warning('请输入有效的操作金额');
      return;
    }
    
    setAdjustingBalance(true);
    try {
      const res = await api.adjustBalance({ action, amount: amt });
      message.success(`余额${action === 'add' ? '增加' : '减少'}成功，当前余额：${res.data.new_balance}`);
      setBalanceAmount('');
    } catch (error: any) {
      message.error(error instanceof Error ? error.message : '操作失败');
    } finally {
      setAdjustingBalance(false);
      queryClient.invalidateQueries({ queryKey: ['systemState'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    }
  };
  
  const loadModelVersions = async () => {
    try {
      const res = await api.getModelVersions();
      setModelVersions(res.data.data || []);
    } catch {
      // 加载失败，静默处理
    }
  };

  const filteredModelVersions = useMemo(() => {
    if (modelVersionModeFilter === 'all') return modelVersions;
    return modelVersions.filter(v => v?.prediction_mode === modelVersionModeFilter);
  }, [modelVersions, modelVersionModeFilter]);

  const loadDbRecords = async () => {
    try {
      const res = await api.getDatabaseRecords(dbTable, dbPage);
      setDbRecords(res.data.data || []);
    } catch {
      // 加载失败，静默处理
    }
  };

  const loadAiLearningStatus = async () => {
    try {
      const res = await api.getAiLearningStatus();
      setAiLearningStatus(res.data);
    } catch {
      // 加载失败，静默处理
    }
  };

  const loadThreeModelStatus = async () => {
    try {
      const res = await api.getThreeModelStatus();
      setThreeModelStatus(res.data);
    } catch {
      // 加载失败，静默处理
    }
  };

  const loadSingleAiPromptTemplates = useCallback(async () => {
    setSingleAiPromptLoading(true);
    try {
      const res = await api.getSingleAiPromptTemplates();
      const hasLegacyPrediction = !String(res.data.prediction_template || '').trim() || isLegacyPromptTemplate(res.data.prediction_template);
      const hasLegacyRealtime = !String(res.data.realtime_strategy_template || '').trim() || isLegacyPromptTemplate(res.data.realtime_strategy_template);

      if (hasLegacyPrediction || hasLegacyRealtime) {
        await api.updateSingleAiPromptTemplates({
          prediction_template: DEFAULT_SINGLE_AI_PREDICTION_TEMPLATE,
          realtime_strategy_template: DEFAULT_SINGLE_AI_REALTIME_STRATEGY_TEMPLATE,
        });
        const migrated = await api.getSingleAiPromptTemplates();
        setSingleAiActiveVersion(migrated.data.active_version || null);
        setSingleAiPredictionTemplate(resolvePredictionTemplate(migrated.data.prediction_template));
        setSingleAiRealtimeStrategyTemplate(resolveRealtimeStrategyTemplate(migrated.data.realtime_strategy_template));
        message.success('已自动替换为系统中文模板');
        return;
      }

      setSingleAiActiveVersion(res.data.active_version || null);
      setSingleAiPredictionTemplate(resolvePredictionTemplate(res.data.prediction_template));
      setSingleAiRealtimeStrategyTemplate(resolveRealtimeStrategyTemplate(res.data.realtime_strategy_template));
    } catch (err: any) {
      message.error(err instanceof Error ? err.message : '加载单AI提示词失败');
    } finally {
      setSingleAiPromptLoading(false);
    }
  }, [message]);

  const loadSystemTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await api.getSystemTasks(50);
      setSystemTasks(res.data.tasks || []);
    } catch {
      // 加载失败，静默处理
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const loadMaintenanceStats = useCallback(async () => {
    setMaintenanceLoading(true);
    const timeoutId = window.setTimeout(() => {
      setMaintenanceLoading(false);
    }, 10000);
    try {
      const res = await api.adminMaintenanceStats();
      setMaintenanceStats(res.data);
    } catch (err: any) {
      message.error(err instanceof Error ? err.message : '加载维护统计失败');
    } finally {
      window.clearTimeout(timeoutId);
      setMaintenanceLoading(false);
    }
  }, [message]);

  const runRetentionNow = useCallback(async () => {
    const cfg = maintenanceStats?.config;
    Modal.confirm({
      title: '确认立即执行清理？',
      content: cfg ? (
        <div>
          <div>将按当前配置清理超期日志并裁剪历史数据（保留最近N条）。</div>
          <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.65)' }}>
            P3保留 {cfg.LOG_RETENTION_HOT} 天，P2保留 {cfg.LOG_RETENTION_WARM} 天，历史上限 {cfg.MAX_HISTORY_RECORDS} 条
          </div>
        </div>
      ) : (
        '将按配置清理超期日志并裁剪历史数据（保留最近N条）。'
      ),
      okText: '确认执行',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.adminMaintenanceRunRetention();
          message.success(`清理完成：P3-${res.data.deleted.deleted_p3}、P2-${res.data.deleted.deleted_p2}、局-${res.data.deleted.deleted_game_records}、注-${res.data.deleted.deleted_bet_records}（${res.data.elapsed_ms}ms）`);
          loadMaintenanceStats();
        } catch (err: any) {
          message.error(err instanceof Error ? err.message : '清理失败');
        }
      },
    });
  }, [loadMaintenanceStats, maintenanceStats?.config, message]);

  const resetAllData = useCallback(async () => {
    Modal.confirm({
      title: '确认清空全部数据？',
      content: (
        <div>
          <div>将清空：开奖记录、下注记录、错题本、五路缓存、AI记忆、模型版本、后台任务与系统日志。</div>
          <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.65)' }}>仅允许在开发环境执行，清空后不可恢复。</div>
        </div>
      ),
      okText: '确认清空',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await api.adminMaintenanceResetAll();
          const d = res.data.deleted || {};
          message.success(`已清空：局${d.game_records || 0}、注${d.bet_records || 0}、日志${d.system_logs || 0}`);
          setDbRecords([]);
          setDbPage(1);
          queryClient.invalidateQueries({ queryKey: ['systemState'] });
          queryClient.invalidateQueries({ queryKey: ['stats'] });
          loadMaintenanceStats();
          navigate('/dashboard');
        } catch (err: any) {
          message.error(err instanceof Error ? err.message : '清空失败');
        }
      },
    });
  }, [loadMaintenanceStats, message, navigate, queryClient]);

  const saveSingleAiPromptTemplates = useCallback(async () => {
    setSingleAiPromptSaving(true);
    try {
      await api.updateSingleAiPromptTemplates({
        prediction_template: (singleAiPredictionTemplate || DEFAULT_SINGLE_AI_PREDICTION_TEMPLATE).trim(),
        realtime_strategy_template: (singleAiRealtimeStrategyTemplate || DEFAULT_SINGLE_AI_REALTIME_STRATEGY_TEMPLATE).trim(),
      });
      message.success('单AI提示词已保存并生效');
      loadSingleAiPromptTemplates();
    } catch (err: any) {
      message.error(err instanceof Error ? err.message : '保存单AI提示词失败');
    } finally {
      setSingleAiPromptSaving(false);
    }
  }, [loadSingleAiPromptTemplates, message, singleAiPredictionTemplate, singleAiRealtimeStrategyTemplate]);

  const resetSingleAiPromptTemplates = useCallback(() => {
    Modal.confirm({
      title: '恢复系统中文模板？',
      content: '将把当前模板直接替换为系统推荐的中文模板，并立即保存生效。',
      okText: '确认恢复',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setSingleAiPromptSaving(true);
        try {
          await api.updateSingleAiPromptTemplates({
            prediction_template: DEFAULT_SINGLE_AI_PREDICTION_TEMPLATE,
            realtime_strategy_template: DEFAULT_SINGLE_AI_REALTIME_STRATEGY_TEMPLATE,
          });
          message.success('已恢复系统中文模板');
          loadSingleAiPromptTemplates();
        } catch (err: any) {
          message.error(err instanceof Error ? err.message : '恢复默认失败');
        } finally {
          setSingleAiPromptSaving(false);
        }
      },
    });
  }, [loadSingleAiPromptTemplates, message]);

  const [startLearningVisible, setStartLearningVisible] = useState(false);

  const handleStartLearning = async () => {
    if (predictionMode !== 'ai' && predictionMode !== 'single_ai') {
      message.warning('规则引擎模式下不需要深度学习');
      return;
    }
    try {
      await api.startAiLearning(0, predictionMode);
      message.success('AI深度学习已启动');
      loadAiLearningStatus();
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : '启动学习失败';
      message.error(errorMsg);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai') {
      loadModelVersions();
      loadAiLearningStatus();
      loadThreeModelStatus();
      loadSingleAiPromptTemplates();
    }
    if (activeTab === 'db') {
      loadDbRecords();
      loadMaintenanceStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dbTable, dbPage]);

  useEffect(() => {
    if (activeTab !== 'tasks') return;
    loadSystemTasks();
    const timer = setInterval(loadSystemTasks, 3000);
    return () => clearInterval(timer);
  }, [activeTab, loadSystemTasks]);

  const handleOpenApiConfig = (role: 'banker' | 'player' | 'combined' | 'single') => {
    setApiConfigRole(role);
    setApiConfigVisible(true);
  };

  const handleChangePassword = async () => {
    if (!oldPwd || !newPwd) {
      message.warning('请输入完整密码');
      return;
    }
    try {
      await api.changePassword(oldPwd, newPwd);
      message.success('密码修改成功');
      setChangePwdVisible(false);
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : '修改失败';
      message.error(errorMsg);
      // 记录错误到系统状态面板
      addIssue({
        level: 'warning',
        title: '密码修改失败',
        detail: `修改密码失败: ${errorMsg}`,
        source: 'system',
      });
    }
  };

  const tableColumns = [
    { title: '编号', dataIndex: 'id', width: '8%' },
    
    { title: '靴号', dataIndex: 'boot_number', width: '8%', align: 'center' as const },
    { title: '局号', dataIndex: 'game_number', width: '8%', align: 'center' as const },
    { title: '结果', dataIndex: 'result', width: '8%', align: 'center' as const },
    { title: '预测', dataIndex: 'predict_direction', width: '8%', align: 'center' as const },
    { title: '正确', dataIndex: 'predict_correct', width: '8%', align: 'center' as const, render: (v: boolean | null) => v === null ? '-' : v ? <Tag color="success" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}><Icons.Check /> 是</Tag> : <Tag color="error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}><Icons.Close /> 否</Tag> },
    { title: '盈亏', dataIndex: 'profit_loss', width: '12%', align: 'center' as const },
    { title: '余额', dataIndex: 'balance_after', width: '12%', align: 'center' as const },
  ];

  return (
    <div className="page-wrapper admin-page" style={{ padding: '16px' }}>
      {/* 顶部 */}
      <div className="page-nav-bar" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div className="page-nav-left" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button
            icon={<Icons.Back />}
            onClick={() => {
              const selected = localStorage.getItem('mode_selected') === '1';
              navigate(selected ? '/dashboard' : '/mode');
            }}
            size="small"
          >
            返回总览
          </Button>
          <span className="page-nav-title" style={{ fontSize: 16, fontWeight: 600 }}>管理员后台</span>
          <Tag color="blue">自动验证模式</Tag>
        </div>
        <div className="page-nav-right mobile-action-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button icon={<Icons.Key />} onClick={() => setChangePwdVisible(true)} size="small">修改密码</Button>
          <Button danger icon={<Icons.Logout />} onClick={() => { clearToken(); navigate('/dashboard'); }} size="small">退出登录</Button>
        </div>
      </div>

      <Tabs
        className="admin-tabs"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'ai',
            label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icons.Robot /> {isMobile ? 'AI设置' : 'AI大模型与规则引擎'}</span>,
            children: (
              <div className="admin-tab-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* 分析预测模式设置 */}
                <Card title="分析预测模式设置" size="small" styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.08)' } }}>
                  <div style={{ marginBottom: 16, color: 'rgba(255,255,255,0.6)' }}>
                    选择系统的分析预测大脑。同一时间仅能激活一种模式。
                  </div>
                  <div className="admin-summary-inline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div className="admin-summary-inline" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ color: 'rgba(255,255,255,0.7)' }}>当前模式</div>
                      <Tag color={predictionMode === 'ai' ? 'purple' : predictionMode === 'single_ai' ? 'green' : 'blue'}>
                        {predictionMode === 'ai' ? '3AI模式' : predictionMode === 'single_ai' ? '单AI模式' : '规则引擎模式'}
                      </Tag>
                    </div>
                    <Button type="primary" onClick={() => setModePickerVisible(true)} loading={updatingMode}>
                      选择模式
                    </Button>
                  </div>

                  <Modal
                    open={modePickerVisible}
                    onCancel={() => setModePickerVisible(false)}
                    title="选择模式"
                    footer={null}
                    width={isMobile ? 360 : 720}
                    style={{ maxWidth: 'calc(100vw - 20px)' }}
                    mask={{ closable: false }}
                  >
                    <div style={{ display: 'grid', gap: 12 }}>
                      <Card size="small">
                        <div className="admin-mode-option" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ display: 'grid', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <Icons.Brain />
                              <div style={{ fontWeight: 800 }}>3AI模式（3个大模型）</div>
                              {predictionMode === 'ai' && <Tag color="purple">当前</Tag>}
                              {(!threeModelStatus?.models?.banker?.api_key_set && !threeModelStatus?.models?.player?.api_key_set && !threeModelStatus?.models?.combined?.api_key_set) && (
                                <Tag color="error">未配置API</Tag>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                              三个模型分工协作，等待开奖期间进行微学习。
                            </div>
                            <Space wrap className="mobile-action-row" style={{ width: '100%' }}>
                              <Button size="small" onClick={() => handleOpenApiConfig('banker')}>配置/测试庄模型</Button>
                              <Button size="small" onClick={() => handleOpenApiConfig('player')}>配置/测试闲模型</Button>
                              <Button size="small" onClick={() => handleOpenApiConfig('combined')}>配置/测试综合模型</Button>
                            </Space>
                          </div>
                          <Button
                            className="admin-mode-option-action"
                            type="primary"
                            disabled={predictionMode === 'ai' || !threeModelStatus?.ai_ready_for_enable}
                            loading={updatingMode}
                            onClick={async () => {
                              await applyModeChange('ai');
                              setModePickerVisible(false);
                            }}
                          >
                            启用 3AI 模式
                          </Button>
                        </div>
                      </Card>

                      <Card size="small">
                        <div className="admin-mode-option" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ display: 'grid', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <Icons.Robot />
                              <div style={{ fontWeight: 800 }}>单AI模式（深度求索 V4 专业版）</div>
                              {predictionMode === 'single_ai' && <Tag color="green">当前</Tag>}
                              {!threeModelStatus?.models?.single?.api_key_set && <Tag color="error">未配置API</Tag>}
                            </div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                              单模型直接给出庄/闲预测，等待开奖期间也会进行微学习。
                            </div>
                            <Space wrap className="mobile-action-row" style={{ width: '100%' }}>
                              <Button size="small" onClick={() => handleOpenApiConfig('single')}>配置/测试单AI模型</Button>
                            </Space>
                          </div>
                          <Button
                            className="admin-mode-option-action"
                            type="primary"
                            disabled={predictionMode === 'single_ai' || !threeModelStatus?.single_ai_ready_for_enable}
                            loading={updatingMode}
                            onClick={async () => {
                              await applyModeChange('single_ai');
                              setModePickerVisible(false);
                            }}
                          >
                            启用 单AI 模式
                          </Button>
                        </div>
                      </Card>

                      <Card size="small">
                        <div className="admin-mode-option" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <div style={{ display: 'grid', gap: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <Icons.Trend />
                              <div style={{ fontWeight: 800 }}>规则引擎模式</div>
                              {predictionMode === 'rule' && <Tag color="blue">当前</Tag>}
                            </div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                              纯规则预测，不需要配置任何大模型接口。
                            </div>
                          </div>
                          <Button
                            className="admin-mode-option-action"
                            type="primary"
                            disabled={predictionMode === 'rule'}
                            loading={updatingMode}
                            onClick={async () => {
                              await applyModeChange('rule');
                              setModePickerVisible(false);
                            }}
                          >
                            启用 规则模式
                          </Button>
                        </div>
                      </Card>
                    </div>
                  </Modal>
                </Card>

                {/* 资金与余额管理 */}
                <Card title="资金与余额管理" size="small" styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.08)' } }}>
                  <div style={{ marginBottom: 16, color: 'rgba(255,255,255,0.6)' }}>
                    系统风险主要体现在下注金额上。您可以随时在此为系统增加或扣除测试余额。
                    当前系统余额：<span style={{ fontSize: 18, color: '#52c41a', fontWeight: 'bold' }}>{formatMoney(systemState?.balance)}</span>
                  </div>
                  <Space className="mobile-action-row" style={{ display: 'flex', flexWrap: 'wrap', width: '100%' }}>
                      <Input 
                      placeholder="输入操作金额" 
                      type="number"
                      value={balanceAmount}
                      onChange={(e) => setBalanceAmount(e.target.value)}
                        className="mobile-fill-control"
                        style={{ width: 200, maxWidth: '100%', background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                    />
                    <Button 
                      type="primary" 
                      style={{ background: '#52c41a', borderColor: '#52c41a' }}
                      loading={adjustingBalance}
                      onClick={() => handleBalanceAdjust('add')}
                    >
                      增加余额
                    </Button>
                    <Button 
                      danger 
                      type="primary"
                      loading={adjustingBalance}
                      onClick={() => handleBalanceAdjust('sub')}
                    >
                      减少余额
                    </Button>
                  </Space>
                </Card>

                {/* 三模型状态 */}
                <Card title="三模型状态" size="small">
                  {threeModelStatus ? (
                    <Row gutter={[12, 12]}>
                      <Col xs={24} sm={8}>
                        <Card size="small" style={{ borderLeft: '3px solid #ff4d4f', background: 'rgba(255,77,79,0.04)' }}>
                          <div style={{ fontWeight: 700, color: '#ff4d4f', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icons.Banker /> 庄模型</span>
                            <Button type="link" size="small" onClick={() => handleOpenApiConfig('banker')}>配置接口</Button>
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                            {getProviderModelSummary(
                              threeModelStatus.models?.banker?.provider,
                              threeModelStatus.models?.banker?.model,
                            )}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            {threeModelStatus.models?.banker?.api_key_set ? (
                              <Tag color="success" style={{ display: 'flex', alignItems: 'center', gap: 2, width: 'fit-content' }}><Icons.Check /> 已配置</Tag>
                            ) : (
                              <Tag color="error" style={{ display: 'flex', alignItems: 'center', gap: 2, width: 'fit-content' }}><Icons.Close /> 未配置</Tag>
                            )}
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Card size="small" style={{ borderLeft: '3px solid #1890ff', background: 'rgba(24,144,255,0.04)' }}>
                          <div style={{ fontWeight: 700, color: '#1890ff', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icons.Player /> 闲模型</span>
                            <Button type="link" size="small" onClick={() => handleOpenApiConfig('player')}>配置接口</Button>
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                            {getProviderModelSummary(
                              threeModelStatus.models?.player?.provider,
                              threeModelStatus.models?.player?.model,
                            )}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            {threeModelStatus.models?.player?.api_key_set ? (
                              <Tag color="success" style={{ display: 'flex', alignItems: 'center', gap: 2, width: 'fit-content' }}><Icons.Check /> 已配置</Tag>
                            ) : (
                              <Tag color="error" style={{ display: 'flex', alignItems: 'center', gap: 2, width: 'fit-content' }}><Icons.Close /> 未配置</Tag>
                            )}
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Card size="small" style={{ borderLeft: '3px solid #52c41a', background: 'rgba(82,196,26,0.04)' }}>
                          <div style={{ fontWeight: 700, color: '#52c41a', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icons.Brain /> 综合模型</span>
                            <Button type="link" size="small" onClick={() => handleOpenApiConfig('combined')}>配置接口</Button>
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                            {getProviderModelSummary(
                              threeModelStatus.models?.combined?.provider,
                              threeModelStatus.models?.combined?.model,
                            )}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            {threeModelStatus.models?.combined?.api_key_set ? (
                              <Tag color="success" style={{ display: 'flex', alignItems: 'center', gap: 2, width: 'fit-content' }}><Icons.Check /> 已配置</Tag>
                            ) : (
                              <Tag color="error" style={{ display: 'flex', alignItems: 'center', gap: 2, width: 'fit-content' }}><Icons.Close /> 未配置</Tag>
                            )}
                          </div>
                        </Card>
                      </Col>
                    </Row>
                  ) : (
                    <Empty description="加载中..." />
                  )}
                </Card>

                <Card
                  title="单AI提示词与策略模板"
                  size="small"
                  extra={
                    <Space size={8} wrap className="admin-template-meta">
                      {singleAiActiveVersion && <Tag color="blue">版本：{singleAiActiveVersion}</Tag>}
                      <Button size="small" loading={singleAiPromptLoading} onClick={loadSingleAiPromptTemplates}>刷新</Button>
                    </Space>
                  }
                >
                  {singleAiPromptLoading ? (
                    <Empty description="加载中..." />
                  ) : (
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                        单AI模式每一局都会自动分析、自动预测并自动下注。这里配置的是中文分析模板和等待开奖时的策略提炼模板，系统已经内置推荐中文版本。
                      </div>

                      <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                        如果你不想自己编写，直接使用系统推荐中文模板即可；恢复系统中文模板后会立即覆盖当前内容。
                      </div>

                      <div style={{ fontWeight: 700 }}>下一局预测分析模板</div>
                      <Input.TextArea
                        value={singleAiPredictionTemplate}
                        onChange={(e) => setSingleAiPredictionTemplate(e.target.value)}
                        autoSize={{ minRows: isMobile ? 10 : 8, maxRows: isMobile ? 18 : 16 }}
                        placeholder="请输入中文分析模板。系统会自动补入当前靴号、局号、完整历史、五路特征、五路原始数据和失误上下文。"
                        style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                      />

                      <div style={{ fontWeight: 700 }}>等待开奖策略模板</div>
                      <Input.TextArea
                        value={singleAiRealtimeStrategyTemplate}
                        onChange={(e) => setSingleAiRealtimeStrategyTemplate(e.target.value)}
                        autoSize={{ minRows: isMobile ? 8 : 6, maxRows: isMobile ? 14 : 12 }}
                        placeholder="请输入中文策略模板。系统会自动补入完整历史、五路特征、五路原始数据和连续失准次数。"
                        style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                      />

                      <Space wrap className="mobile-action-row admin-template-actions" style={{ width: '100%' }}>
                        <Button
                          onClick={() => {
                            setSingleAiPredictionTemplate(DEFAULT_SINGLE_AI_PREDICTION_TEMPLATE);
                            setSingleAiRealtimeStrategyTemplate(DEFAULT_SINGLE_AI_REALTIME_STRATEGY_TEMPLATE);
                            message.success('已填入系统推荐中文模板，请点击“保存并生效”');
                          }}
                        >
                          填入系统推荐中文模板
                        </Button>
                        <Button type="primary" loading={singleAiPromptSaving} onClick={saveSingleAiPromptTemplates}>保存并生效</Button>
                        <Button danger loading={singleAiPromptSaving} onClick={resetSingleAiPromptTemplates}>恢复系统中文模板</Button>
                      </Space>
                    </Space>
                  )}
                </Card>

                {/* AI学习 */}
                <Card title="AI学习" size="small">
                  <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                    <Row gutter={[12, 12]}>
                      <Col xs={24} sm={8}>
                        <Statistic title="学习条件" value="20~1000局" suffix="历史数据" />
                      </Col>
                      <Col xs={24} sm={8}>
                        <Statistic title="学习范围" value="全库学习" suffix="最多1000局" />
                      </Col>
                      <Col xs={24} sm={8}>
                        <Statistic 
                          title="当前状态" 
                          value={aiLearningStatus?.is_learning ? '学习中' : '空闲'} 
                          styles={{ content: { color: aiLearningStatus?.is_learning ? '#faad14' : '#52c41a' } }} 
                        />
                      </Col>
                    </Row>
                    <div className="admin-learning-cta" style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                      <Button 
                        type="primary" 
                        icon={<Icons.AI />} 
                        onClick={() => {
                          if (predictionMode !== 'ai' && predictionMode !== 'single_ai') {
                            message.warning('规则引擎模式下不需要深度学习');
                            return;
                          }
                          setStartLearningVisible(true);
                        }}
                        loading={aiLearningStatus?.is_learning}
                        style={{ background: 'linear-gradient(135deg, #722ed1, #531dab)', border: 'none', width: '100%', maxWidth: 300, height: 40 }}
                      >
                        {aiLearningStatus?.is_learning ? `正在学习: ${aiLearningStatus.current_task}` : '启动深度学习'}
                      </Button>
                    </div>
                  </Space>
                </Card>

                {/* 模型版本列表 */}
                <Card title="模型版本管理" size="small">
                  <Space style={{ marginBottom: 12, flexWrap: 'wrap' }} className="mobile-action-row">
                    <span style={{ color: 'rgba(255,255,255,0.65)' }}>模式筛选</span>
                    <Select
                      value={modelVersionModeFilter}
                      onChange={setModelVersionModeFilter}
                      className="mobile-fill-control"
                      style={{ width: 160 }}
                      options={[
                        { label: '全部', value: 'all' },
                        { label: '3AI', value: 'ai' },
                        { label: '单AI', value: 'single_ai' },
                      ]}
                      size="small"
                    />
                  </Space>
                  <Table
                    dataSource={filteredModelVersions}
                    className="mobile-card-table admin-model-version-table"
                    columns={withMobileTableLabels([
                      { title: '版本号', dataIndex: 'version', width: '12%' },
                      { title: '模式', dataIndex: 'prediction_mode', width: '10%', align: 'center' as const, render: (v: string) => v === 'single_ai' ? <Tag color="green">单AI</Tag> : <Tag color="purple">3AI</Tag> },
                      { title: '创建时间', dataIndex: 'created_at', width: '18%', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
                      { title: '样本数', dataIndex: 'training_sample_count', width: '10%', align: 'center' as const },
                      { title: '学习前准确率', dataIndex: 'accuracy_before', width: '12%', align: 'center' as const, render: (v: number) => v ? `${(v*100).toFixed(1)}%` : '-' },
                      { title: '学习后准确率', dataIndex: 'accuracy_after', width: '12%', align: 'center' as const, render: (v: number) => v ? `${(v*100).toFixed(1)}%` : '-' },
                      { title: '状态', dataIndex: 'is_active', width: '10%', align: 'center' as const, render: (v: boolean) => v ? <Tag color="green">使用中</Tag> : <Tag>未启用</Tag> },
                      { title: '使用局数', dataIndex: 'total_runs', width: '10%', align: 'center' as const },
                      { title: '命中数', dataIndex: 'hit_count', width: '10%', align: 'center' as const },
                    ])}
                    rowKey="version"
                    size="small"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    locale={{ emptyText: <Empty description="暂无模型版本" /> }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'tasks',
            label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icons.Experiment /> {isMobile ? '任务' : '后台任务'}</span>,
            children: (
              <Card title="后台任务" size="small">
                <Space style={{ marginBottom: 12, flexWrap: 'wrap' }} className="mobile-action-row">
                  <Button size="small" onClick={loadSystemTasks} loading={tasksLoading}>刷新</Button>
                </Space>
                <Table
                  className="mobile-card-table admin-tasks-table"
                  dataSource={systemTasks}
                  loading={tasksLoading}
                  rowKey="task_id"
                  size="small"
                  pagination={{ pageSize: 50 }}
                  scroll={{ x: 'max-content' }}
                  locale={{ emptyText: <Empty description="暂无后台任务" /> }}
                  columns={withMobileTableLabels([
                    { title: '类型', dataIndex: 'task_type', width: 120 },
                    { title: '靴号', dataIndex: 'boot_number', width: 80, align: 'center' as const, render: (v: number | null) => v ?? '-' },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      width: 110,
                      align: 'center' as const,
                      render: (v: api.BackgroundTaskStatus) => {
                        if (v === 'running') return <Tag color="blue">运行中</Tag>;
                        if (v === 'succeeded') return <Tag color="success">已完成</Tag>;
                        if (v === 'failed') return <Tag color="error">失败</Tag>;
                        if (v === 'cancelled') return <Tag>已取消</Tag>;
                        return <Tag>未知</Tag>;
                      },
                    },
                    {
                      title: '创建时间',
                      dataIndex: 'created_at',
                      width: 170,
                      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
                    },
                    { title: '消息', dataIndex: 'message', ellipsis: true },
                    { title: '失败原因', dataIndex: 'error', ellipsis: true, render: (v: string | null) => v || '-' },
                    {
                      title: '任务编号',
                      dataIndex: 'task_id',
                      width: 160,
                      render: (v: string) => (
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0 }}
                          onClick={async () => {
                            const ok = await copyText(v);
                            if (ok) {
                              message.success('任务编号已复制');
                            } else {
                              message.error('复制失败');
                            }
                          }}
                        >
                          复制
                        </Button>
                      ),
                    },
                    {
                      title: '操作',
                      width: 170,
                      align: 'center' as const,
                      render: (_: any, record: api.BackgroundTaskItem) => (
                        <Space size={8} wrap>
                          <Button
                            size="small"
                            onClick={() => navigate(`/dashboard/logs?task_id=${encodeURIComponent(record.task_id)}`)}
                          >
                            查看日志
                          </Button>
                          <Button
                            size="small"
                            danger
                            disabled={record.status !== 'running'}
                            onClick={() => {
                              Modal.confirm({
                                title: '确认取消任务？',
                                content: '取消后可能会导致本次学习/分析不完整，请谨慎操作。',
                                okText: '确认取消',
                                cancelText: '暂不取消',
                                onOk: async () => {
                                  try {
                                    await api.cancelSystemTask(record.task_id);
                                    message.success('已取消任务');
                                    loadSystemTasks();
                                  } catch (err: any) {
                                    message.error(err instanceof Error ? err.message : '取消失败');
                                  }
                                },
                              });
                            }}
                          >
                            取消
                          </Button>
                        </Space>
                      ),
                    },
                  ])}
                />
              </Card>
            ),
          },
          {
            key: 'db',
            label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icons.Database /> {isMobile ? '数据库' : '数据库存储'}</span>,
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Card
                  title="维护与清理"
                  size="small"
                  extra={
                    <Space size={8} className="mobile-action-row admin-maintenance-extra">
                      <Button size="small" loading={maintenanceLoading} onClick={loadMaintenanceStats}>刷新统计</Button>
                      <Button size="small" danger onClick={runRetentionNow}>立即清理</Button>
                      <Button size="small" danger onClick={resetAllData}>清空全部数据</Button>
                    </Space>
                  }
                >
                  <Row gutter={[12, 12]}>
                    <Col xs={24} sm={12} md={8}>
                      <Statistic
                        title="数据库大小（本地库）"
                        value={
                          maintenanceStats?.sqlite_size_bytes
                            ? `${(maintenanceStats.sqlite_size_bytes / 1024 / 1024).toFixed(2)} MB`
                            : '不可用'
                        }
                      />
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Statistic title="开奖记录" value={maintenanceStats?.counts.game_records_total ?? '-'} />
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Statistic title="下注记录" value={maintenanceStats?.counts.bet_records_total ?? '-'} />
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Statistic title="日志总量" value={maintenanceStats?.counts.system_logs_total ?? '-'} />
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Statistic title="P1 / P2 / P3" value={`${maintenanceStats?.counts.system_logs_p1 ?? '-'} / ${maintenanceStats?.counts.system_logs_p2 ?? '-'} / ${maintenanceStats?.counts.system_logs_p3 ?? '-'}`} />
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Statistic title="置顶日志" value={maintenanceStats?.counts.system_logs_pinned ?? '-'} />
                    </Col>
                  </Row>

                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <Space size={8} wrap className="admin-maintenance-tags">
                      <Tag color={maintenanceStats ? (maintenanceStats.config.RETENTION_ENABLED ? 'green' : 'default') : 'default'}>
                        自动清理 {maintenanceStats ? (maintenanceStats.config.RETENTION_ENABLED ? '开启' : '关闭') : '加载中'}
                      </Tag>
                      <Tag color="blue">P3保留 {maintenanceStats?.config.LOG_RETENTION_HOT ?? '-'} 天</Tag>
                      <Tag color="gold">P2保留 {maintenanceStats?.config.LOG_RETENTION_WARM ?? '-'} 天</Tag>
                      <Tag color="purple">历史上限 {maintenanceStats?.config.MAX_HISTORY_RECORDS ?? '-'} 条</Tag>
                      <Tag color="default">间隔 {maintenanceStats?.config.RETENTION_INTERVAL_SECONDS ?? '-'} 秒</Tag>
                      <Tag color="default">
                        最近手动清理 {maintenanceStats?.last_manual_retention_at ? dayjs(maintenanceStats.last_manual_retention_at).format('YYYY-MM-DD HH:mm:ss') : '无'}
                      </Tag>
                    </Space>
                  </div>
                </Card>

                <Card title="数据库记录查看" size="small">
                  <Space style={{ marginBottom: 16, flexWrap: 'wrap' }} className="mobile-action-row">
                    <span>选择表：</span>
                    <Select
                      value={dbTable}
                      onChange={(v) => { setDbTable(v); setDbPage(1); }}
                      className="mobile-fill-control"
                      style={{ width: 160, maxWidth: '100%' }}
                      options={[
                        { label: '开奖记录', value: 'game_records' },
                        { label: '下注记录', value: 'bet_records' },
                        { label: '系统日志', value: 'system_logs' },
                        { label: '错题本', value: 'mistake_book' },
                      ]}
                    />
                  </Space>
                  <Table
                    className="mobile-card-table admin-db-table"
                    dataSource={dbRecords}
                    columns={withMobileTableLabels(tableColumns)}
                    rowKey="id"
                    size="small"
                    scroll={{ x: 'max-content' }}
                    pagination={{ current: dbPage, pageSize: 50, onChange: setDbPage, total: 1000 }}
                  />
                </Card>
              </Space>
            ),
          },
        ]}
      />

      {/* 修改密码弹窗 */}
      <Modal
        className="admin-change-password-modal"
        title="修改密码"
        open={changePwdVisible}
        closable
        mask={{ closable: true }}
        onCancel={() => setChangePwdVisible(false)}
        onOk={handleChangePassword}
        okText="保存新密码"
        cancelText="取消"
        width={isMobile ? 360 : 520}
        style={{ maxWidth: 'calc(100vw - 20px)' }}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Input.Password placeholder="当前密码" value={oldPwd} onChange={e => setOldPwd(e.target.value)} />
          <Input.Password placeholder="新密码" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
        </Space>
      </Modal>

      {/* 开始深度学习确认弹窗 */}
      <StartLearningModal
        visible={startLearningVisible}
        onClose={() => setStartLearningVisible(false)}
        onConfirm={handleStartLearning}
        modeLabel={predictionMode === 'ai' ? '3AI模式' : '单AI模式（深度求索 V4 专业版）'}
      />

      {/* 接口配置弹窗 */}
      <ApiConfigModal 
        visible={apiConfigVisible}
        onCancel={() => setApiConfigVisible(false)}
        onSuccess={async () => {
          await loadThreeModelStatus();
          if (shouldCloseApiConfigModalAfterSave()) setApiConfigVisible(false);
        }}
        role={apiConfigRole}
        currentStatus={threeModelStatus}
      />
    </div>
  );
};

export default AdminPage;
