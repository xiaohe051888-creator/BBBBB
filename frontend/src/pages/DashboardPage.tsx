/**
 * 主仪表盘页面 - 智能AI（手动模式）
 * 流程：上传数据 → AI预测 → 用户下注 → 等待开奖 → 输入结果 → 结算 → 预测下一局
 * 
 * 优化：乐观UI策略 - 数据立即显示，后台静默刷新，零等待体验
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Tag, Space,
  Empty, message, Progress, Select, Switch,
} from 'antd';
import { getToken } from '../services/api';
import { LOG_CATEGORIES, MAX_GAMES_PER_BOOT, DEFAULT_BET_AMOUNT } from '../utils/constants';
import { FiveRoadChart } from '../components/roads';
import { BetModal, RevealModal, LoginModal } from '../components/dashboard';
import { GameTable, BetTable, LogTable } from '../components/tables';
import { SmartReport, SmartAlertsPanel } from '../components/smart';
import { SystemStatusPanel } from '../components/ui/SystemStatusPanel';
import {
  useAdminLogin,
  useWaitTimer,
  useSmartDetection,
  useWorkflowState,
  useSystemDiagnostics,
  // React Query Hooks (乐观UI - 零等待)
  useSystemStateQuery,
  useStatsQuery,
  useLogsQuery,
  useGamesQuery,
  useBetsQuery,
  useRoadsQuery,
  useAnalysisQuery,
  usePlaceBetMutation,
  useRevealResultMutation,
  useAddLogOptimistically,
  useAddBetOptimistically,
  useUpdateBetOptimistically,
  useAddGameOptimistically,
  useUpdateRoadsOptimistically,
  useUpdateStateOptimistically,
} from '../hooks';
import * as api from '../services/api';

// 精致SVG图标组件
const Icons = {
  Reload: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
    </svg>
  ),
  Upload: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
    </svg>
  ),
  Lock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
    </svg>
  ),
  Unlock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/>
    </svg>
  ),
  Chart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
    </svg>
  ),
  Target: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3-8c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/>
    </svg>
  ),
  Coin: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/>
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
    </svg>
  ),
  File: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </svg>
  ),
  Shield: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
    </svg>
  ),
  Globe: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  ),
  Robot: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c-4.97 0-9 4.03-9 9 0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11c0-4.97-4.03-9-9-9zm0 2c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.3c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
    </svg>
  ),
  Fire: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/>
    </svg>
  ),
  Bulb: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/>
    </svg>
  ),
};

// ====== 组件定义 ======

const DashboardPage: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  // ====== 系统实时诊断（WebSocket状态、后端状态、AI模型状态） ======
  const { diagnostics, dismissIssue, retryConnection } = useSystemDiagnostics({ tableId });

  // ====== React Query 数据获取（乐观UI - 零等待）======
  // 使用 placeholderData 确保数据立即显示，后台静默刷新
  const { data: systemState } = useSystemStateQuery({ tableId });
  const { data: stats } = useStatsQuery({ tableId });
  const { data: analysis, isFetching: analysisFetching } = useAnalysisQuery({ tableId });
  const { data: logsData } = useLogsQuery({ tableId, pageSize: 50 });
  const { data: gamesData } = useGamesQuery({ tableId, page: 1 });
  const { data: betsData } = useBetsQuery({ tableId, page: 1 });
  const { data: roadData } = useRoadsQuery({ tableId });

  // 提取数据
  const logs = logsData?.logs || [];
  const games = gamesData?.games || [];
  const bets = betsData?.bets || [];
  const gamesTotal = gamesData?.total || 0;
  const betsTotal = betsData?.total || 0;

  // 分页状态
  const [gamePage, setGamePage] = useState(1);
  const [betPage, setBetPage] = useState(1);

  // AI分析状态 - 智能检测：有数据且正在获取时才显示分析中
  const hasGameData = games.length > 0;
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  
  // 智能分析状态：只有有游戏数据且正在获取分析时才显示"分析中"
  useEffect(() => {
    // 有数据且正在获取分析 -> 显示分析中
    // 无数据 -> 显示等待上传
    // 有数据且有分析结果 -> 显示分析结果
    if (hasGameData && analysisFetching) {
      setAiAnalyzing(true);
    } else if (!hasGameData) {
      setAiAnalyzing(false);
    } else if (analysis) {
      setAiAnalyzing(false);
    }
  }, [hasGameData, analysisFetching, analysis]);

  // ====== 智能检测系统 ======
  const {
    integrityIssues,
    hasCriticalIssues,
    abnormalPatterns,
    consecutiveResults,
    recentWinRate,
    bettingAdvice,
    alerts,
    removeAlert,
    isDataStale,
    markSynced,
  } = useSmartDetection({
    games,
    bets,
    systemState: systemState || null,
    tableId,
  });

  // 智能工作流状态
  const {
    workflowStatus,
    timer,
    formattedTime,
    isActionOverdue,
    overdueMessage,
    suggestedAction,
  } = useWorkflowState({
    tableId,
    systemStatus: systemState?.status || (games.length === 0 ? '待上传数据' : '待操作'),
    pendingBet: systemState?.pending_bet || null,
    currentGameNumber: systemState?.game_number || 0,
  });

  // 数据同步标记
  useEffect(() => {
    if (games.length > 0 || bets.length > 0) {
      markSynced();
    }
  }, [games.length, bets.length, markSynced]);

  // Mutations
  const placeBetMutation = usePlaceBetMutation();
  const revealResultMutation = useRevealResultMutation();

  // 乐观更新函数（用于WebSocket实时推送）
  const addLogOptimistically = useAddLogOptimistically();
  const addBetOptimistically = useAddBetOptimistically();
  const updateBetOptimistically = useUpdateBetOptimistically();
  const addGameOptimistically = useAddGameOptimistically();
  const updateRoadsOptimistically = useUpdateRoadsOptimistically();
  const updateStateOptimistically = useUpdateStateOptimistically();

  // WebSocket 实时接收所有事件（日志、下注、开奖、分析、状态更新）
  useEffect(() => {
    if (!tableId) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connectWS = () => {
      if (isUnmounted) return;
      try {
        const ws = api.createWebSocket(tableId);

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const { type, data } = msg;

            switch (type) {
              case 'log':
                // 实时添加新日志
                if (data) addLogOptimistically(tableId, data);
                break;

              case 'bet_placed':
                // 实时添加下注记录
                if (data) {
                  addBetOptimistically(tableId, {
                    game_number: data.game_number,
                    bet_direction: data.direction,
                    bet_amount: data.amount,
                    bet_tier: data.tier,
                    status: data.status,
                    balance_before: data.balance_after + data.amount, // 推算下注前余额
                    balance_after: data.balance_after,
                    bet_time: new Date().toISOString(),
                    game_result: null,
                    error_id: null,
                    settlement_amount: null,
                    profit_loss: null,
                    adapt_summary: null,
                  });
                  // 实时更新系统状态（余额、待开奖）
                  updateStateOptimistically(tableId, {
                    balance: data.balance_after,
                    pending_bet: {
                      direction: data.direction,
                      amount: data.amount,
                      tier: data.tier,
                      game_number: data.game_number,
                      time: new Date().toISOString(),
                    },
                    status: '等待开奖',
                  });
                }
                break;

              case 'game_revealed':
                // 实时添加开奖记录
                if (data) {
                  addGameOptimistically(tableId, {
                    game_number: data.game_number,
                    result: data.result,
                    predict_direction: data.predict_direction,
                    predict_correct: data.predict_correct,
                    settlement_status: data.settlement?.status,
                    profit_loss: data.settlement?.profit_loss ?? 0,
                    balance_after: data.balance,
                    result_time: new Date().toISOString(),
                    error_id: null,
                  });
                  // 更新下注记录状态（结算）
                  if (data.settlement) {
                    updateBetOptimistically(tableId, data.game_number, {
                      status: data.settlement.status,
                      game_result: data.result,
                      settlement_amount: data.settlement.settlement_amount,
                      profit_loss: data.settlement.profit_loss,
                    });
                  }
                  // 实时更新系统状态
                  updateStateOptimistically(tableId, {
                    balance: data.balance,
                    game_number: data.game_number,
                    current_game_result: data.result,
                    pending_bet: null,
                    status: '分析中',
                  });
                }
                break;

              case 'analysis':
                // AI分析完成，更新预测信息
                if (data) {
                  updateStateOptimistically(tableId, {
                    predict_direction: data.predict_direction,
                    predict_confidence: data.confidence,
                    current_bet_tier: data.bet_tier,
                    status: '等待下注',
                  });
                }
                break;

              case 'state_update':
                // 通用状态更新（如上传数据后）
                if (data) {
                  updateStateOptimistically(tableId, {
                    status: data.status,
                    boot_number: data.boot_number,
                    game_number: data.game_number,
                  });
                }
                break;

              default:
                // 未知类型，忽略
                break;
            }
          } catch {
            // WebSocket消息解析错误，忽略
          }
        };

        ws.onclose = () => {
          if (!isUnmounted) {
            reconnectTimer = setTimeout(connectWS, 3000);
          }
        };
      } catch {
        if (!isUnmounted) {
          reconnectTimer = setTimeout(connectWS, 5000);
        }
      }
    };

    connectWS();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [
    tableId,
    addLogOptimistically,
    addBetOptimistically,
    updateBetOptimistically,
    addGameOptimistically,
    updateStateOptimistically,
  ]);

  // 日志分类筛选
  const [logCategory, setLogCategory] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState(true);

  // 等待开奖计时器
  const hasPendingBet = !!systemState?.pending_bet;
  const { seconds: waitSeconds } = useWaitTimer({ enabled: hasPendingBet });

  // 开奖弹窗
  const [revealVisible, setRevealVisible] = useState(false);
  const [revealResult, setRevealResult] = useState<'庄' | '闲' | '和' | ''>('');
  const [revealLoading, setRevealLoading] = useState(false);

  // 下注弹窗
  const [betVisible, setBetVisible] = useState(false);
  const [betDirection, setBetDirection] = useState<'庄' | '闲'>('庄');
  const [betAmount, setBetAmount] = useState<number>(DEFAULT_BET_AMOUNT);
  const [betLoading, setBetLoading] = useState(false);

  // 管理员登录 Hook
  const {
    visible: loginVisible,
    password: loginPassword,
    loading: loginLoading,
    openLogin,
    closeLogin,
    setPassword: setLoginPassword,
    handleLogin: handleAdminLogin,
  } = useAdminLogin();

  // ====== 操作方法 ======

  // 打开开奖弹窗
  const handleOpenReveal = () => {
    setRevealResult('');
    setRevealVisible(true);
  };

  // 确认开奖
  const handleConfirmReveal = async () => {
    if (!revealResult) {
      message.warning('请选择开奖结果');
      return;
    }
    const gameNumber = systemState?.pending_bet?.game_number ?? systemState?.next_game_number;
    if (!gameNumber || !tableId) return;

    setRevealLoading(true);
    try {
      await revealResultMutation.mutateAsync({
        tableId,
        result: revealResult,
      });
      message.success(`开奖${revealResult}已记录，AI正在分析下一局...`);
      setRevealVisible(false);
      setAiAnalyzing(true);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '开奖失败，请重试';
      message.error(errorMsg);
    } finally {
      setRevealLoading(false);
    }
  };

  // 打开下注弹窗（使用AI推荐）
  const handleOpenBet = () => {
    if (systemState?.predict_direction) {
      setBetDirection(systemState.predict_direction as '庄' | '闲');
    }
    // 使用AI推荐金额（默认DEFAULT_BET_AMOUNT）
    setBetAmount(DEFAULT_BET_AMOUNT);
    setBetVisible(true);
  };

  // 确认下注
  const handleConfirmBet = async () => {
    if (!betDirection) {
      message.warning('请选择下注方向');
      return;
    }
    const gameNumber = systemState?.next_game_number;
    if (!gameNumber || !tableId) return;

    setBetLoading(true);
    try {
      await placeBetMutation.mutateAsync({
        tableId,
        direction: betDirection,
        amount: betAmount,
      });
      message.success(`已下注第${gameNumber}局 ${betDirection} ${betAmount}元`);
      setBetVisible(false);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '下注失败，请重试';
      message.error(errorMsg);
    } finally {
      setBetLoading(false);
    }
  };

  // 状态颜色
  const getStatusColor = (status: string) => {
    if (status === '等待开奖') return '#faad14';
    if (status === '等待下注') return '#52c41a';
    if (status === '分析中') return '#1890ff';
    return 'rgba(255,255,255,0.5)';
  };

  const getStatusDot = (status: string) => {
    if (status === '等待开奖') return '#faad14';
    if (status === '等待下注') return '#52c41a';
    if (status === '分析中') return '#1890ff';
    return '#8b949e';
  };

  // 将后端状态文字转为更易懂的中文说明
  const getDisplayStatus = (status: string | undefined, gameCount: number) => {
    if (!status || status === '空闲') {
      return gameCount === 0 ? '待上传数据' : '待操作';
    }
    return status;
  };

  // 是否有待开奖注单
  const pendingGameNumber = systemState?.pending_bet?.game_number ?? systemState?.next_game_number;

  // ====== 渲染 ======
  // 乐观UI：始终立即渲染，不显示骨架屏
  // 数据从缓存读取，后台静默刷新

  return (
    <div className="dashboard-container">

      {/* ====== 顶部状态栏 ====== */}
      <div className="top-status-bar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>

          {/* 左侧：系统状态 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* 状态指示 */}
            <div className="info-card-mini">
              <div className="status-indicator-dot" style={{ backgroundColor: getStatusDot(systemState?.status || '空闲') }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: getStatusColor(systemState?.status || '') }}>
                {getDisplayStatus(systemState?.status, games.length)}
              </span>
            </div>

            {/* 桌台信息 */}
            <div className="info-card-mini">
              <span style={{ color: '#58a6ff' }}><Icons.Globe /></span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                <strong style={{ color: '#ffd700', marginRight: 4 }}>{tableId}桌</strong>
                · 第{systemState?.boot_number || 0}靴
                · 已{systemState?.game_number || 0}局
              </span>
            </div>

            {/* 模型版本 */}
            <div className="info-card-mini">
              <span style={{ color: '#b37feb' }}><Icons.Robot /></span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                {systemState?.current_model_version || 'v1.0'}
              </span>
            </div>
          </div>

          {/* 中间：当前/预测局（仅PC端）*/}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }} className="hide-on-mobile">
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '8px 18px', textAlign: 'center', minWidth: 140 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 2 }}>当前局</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                第{systemState?.game_number || 0}局
                {systemState?.current_game_result && (
                  <Tag color={systemState.current_game_result === '庄' ? '#ff4d4f' : '#1890ff'}
                    style={{ marginLeft: 8, fontWeight: 800, borderRadius: 6 }}>
                    {systemState.current_game_result}
                  </Tag>
                )}
              </div>
            </div>

            <div style={{ color: 'rgba(255,215,0,0.4)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ transform: 'rotate(45deg)' }}>
                <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
              </svg>
            </div>

            <div style={{ background: 'linear-gradient(135deg,rgba(255,215,0,0.06),rgba(255,215,0,0.02))', borderRadius: 12, padding: '8px 18px', textAlign: 'center', minWidth: 170, border: '1px solid rgba(255,215,0,0.1)' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,215,0,0.6)', letterSpacing: 1.5, marginBottom: 2 }}>预测下一局</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ffd666' }}>
                第{systemState?.next_game_number || (systemState?.game_number || 0) + 1}局
                {systemState?.predict_direction && (
                  <Tag color="gold" style={{ marginLeft: 8, fontWeight: 800, borderRadius: 6, background: 'linear-gradient(135deg,#ffd700,#f0b90b)' }}>
                    {systemState.predict_direction}
                  </Tag>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：余额 + 健康分 + 系统状态 + 操作 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

            {/* 余额 */}
            <div className="info-card-mini">
              <span style={{ fontSize: 14, color: '#73d13d' }}><Icons.Coin /></span>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>余额</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#73d13d' }}>
                  ¥{(systemState?.balance || 20000).toLocaleString()}
                </div>
              </div>
            </div>

            {/* 智能下注建议 */}
            {games.length > 0 && (
              <div className="info-card-mini" style={{ 
                background: bettingAdvice.canBet 
                  ? 'rgba(82,196,26,0.08)' 
                  : 'rgba(255,77,79,0.08)',
                border: `1px solid ${bettingAdvice.canBet ? 'rgba(82,196,26,0.2)' : 'rgba(255,77,79,0.2)'}`
              }}>
                <span style={{ 
                  fontSize: 14, 
                  color: bettingAdvice.canBet ? '#52c41a' : '#ff4d4f' 
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                  </svg>
                </span>
                <div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>下注建议</div>
                  <div style={{ 
                    fontSize: 12, 
                    fontWeight: 600, 
                    color: bettingAdvice.canBet ? '#95de64' : '#ff7875',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {bettingAdvice.canBet 
                      ? (bettingAdvice.suggestedAmount 
                        ? `建议下注¥${bettingAdvice.suggestedAmount}` 
                        : '可以下注')
                      : bettingAdvice.reason
                    }
                  </div>
                </div>
              </div>
            )}

            {/* 健康分 */}
            <div className="info-card-mini">
              <span style={{ color: (systemState?.health_score ?? 100) >= 85 ? '#52c41a' : '#faad14' }}><Icons.Shield /></span>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>健康分</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: (systemState?.health_score ?? 100) >= 85 ? '#52c41a' : '#faad14' }}>
                  {(systemState?.health_score ?? 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* 系统实时状态（紧凑模式 - 点击展开详情） */}
            <SystemStatusPanel
              diagnostics={diagnostics}
              onDismissIssue={dismissIssue}
              onRetryConnection={retryConnection}
              compact
            />

            {/* 操作按钮 */}
            <Space size={8}>
              {/* 返回上传页 */}
              <Button
                icon={<Icons.Upload />}
                onClick={() => navigate('/')}
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', borderRadius: 8 }}
              >
                上传数据
              </Button>

              {/* 管理员登录/进入 */}
              {getToken() ? (
                <Button
                  icon={<Icons.Unlock />}
                  onClick={() => navigate('/admin')}
                  style={{ background: 'rgba(255,215,0,0.08)', borderColor: 'rgba(255,215,0,0.3)', color: '#ffd700', borderRadius: 8 }}
                >
                  管理员
                </Button>
              ) : (
                <Button
                  icon={<Icons.Lock />}
                  onClick={openLogin}
                  style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', borderRadius: 8 }}
                >
                  登录
                </Button>
              )}
            </Space>
          </div>
        </div>
      </div>

      {/* ====== 工作流状态提示栏 ====== */}
      <div style={{
        padding: '10px 20px',
        background: hasPendingBet
          ? 'linear-gradient(135deg, rgba(250,173,20,0.15), rgba(250,173,20,0.08))'
          : analysis?.prediction && !hasPendingBet
            ? 'linear-gradient(135deg, rgba(82,196,26,0.15), rgba(82,196,26,0.08))'
            : !hasGameData
              ? 'linear-gradient(135deg, rgba(24,144,255,0.15), rgba(24,144,255,0.08))'
              : 'linear-gradient(135deg, rgba(150,150,150,0.1), rgba(150,150,150,0.05))',
        borderBottom: `1px solid ${hasPendingBet
          ? 'rgba(250,173,20,0.25)'
          : analysis?.prediction && !hasPendingBet
            ? 'rgba(82,196,26,0.25)'
            : !hasGameData
              ? 'rgba(24,144,255,0.25)'
              : 'rgba(255,255,255,0.1)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20, color: hasPendingBet ? '#faad14' : analysis?.prediction && !hasPendingBet ? '#52c41a' : !hasGameData ? '#1890ff' : '#8b949e' }}>
            {hasPendingBet ? <Icons.Clock /> : analysis?.prediction && !hasPendingBet ? <Icons.Bulb /> : !hasGameData ? <Icons.Upload /> : <Icons.Chart />}
          </span>
          <div>
            <span style={{ 
              fontSize: 14, 
              fontWeight: 700, 
              color: hasPendingBet 
                ? '#faad14' 
                : analysis?.prediction && !hasPendingBet
                  ? '#52c41a'
                  : !hasGameData
                    ? '#1890ff'
                    : '#e6edf3'
            }}>
              {hasPendingBet 
                ? `第 ${pendingGameNumber} 局已下注，等待开奖结果`
                : analysis?.prediction && !hasPendingBet
                  ? `AI分析完成，推荐下注：${analysis.prediction}`
                  : !hasGameData
                    ? '系统已就绪，请上传开奖记录'
                    : `当前第 ${systemState?.game_number || 0} 局，等待下一步操作`}
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginLeft: 12 }}>
              {hasPendingBet 
                ? '请点击右上角【开奖】按钮输入结果'
                : analysis?.prediction && !hasPendingBet
                  ? '点击下方【下注】按钮进行投注'
                  : !hasGameData
                    ? '点击右上角【上传数据】按钮开始'
                    : '请根据系统状态进行相应操作'}
            </span>
          </div>
        </div>

        {/* 等待开奖时显示开奖按钮 */}
        {hasPendingBet && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* 工作流倒计时 */}
            {timer.remaining > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                background: timer.remaining < 30 ? 'rgba(255,77,79,0.1)' : 'rgba(250,173,20,0.1)',
                border: `1px solid ${timer.remaining < 30 ? 'rgba(255,77,79,0.3)' : 'rgba(250,173,20,0.3)'}`,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill={timer.remaining < 30 ? '#ff7875' : '#ffd666'}>
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                </svg>
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: timer.remaining < 30 ? '#ff7875' : '#ffd666',
                  fontFamily: 'monospace',
                }}>
                  {formattedTime}
                </span>
              </div>
            )}
            <Button
              type="primary"
              size="middle"
              onClick={handleOpenReveal}
              style={{
                background: 'linear-gradient(135deg, #faad14, #f0961a)',
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(250,173,20,0.4)',
              }}
            >
              <Icons.Target /> 开奖
            </Button>
          </div>
        )}

        {/* 可以下注时显示下注按钮 */}
        {analysis?.prediction && !hasPendingBet && (
          <Button
            type="primary"
            size="middle"
            onClick={handleOpenBet}
            style={{
              background: analysis.prediction === '庄'
                ? 'linear-gradient(135deg, #ff4d4f, #cf1322)'
                : 'linear-gradient(135deg, #1890ff, #0050b3)',
              border: 'none',
              fontWeight: 700,
              fontSize: 14,
              borderRadius: 8,
              boxShadow: analysis.prediction === '庄'
                ? '0 4px 20px rgba(255,77,79,0.4)'
                : '0 4px 20px rgba(24,144,255,0.4)',
            }}
          >
            <Icons.Coin /> 下注 {analysis.prediction}
          </Button>
        )}
      </div>

      {/* ====== 主体内容区 ====== */}
      <div className="dashboard-main-grid" style={{ padding: 16, display: 'flex', gap: 16 }}>

        {/* ====== 左侧面板 ====== */}
        <div className="left-panel" style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 五路走势图 */}
          <div className="road-chart-card" style={{ minHeight: 420 }}>
            <div className="section-header">
              <span style={{ color: '#722ed1' }}><Icons.Chart /></span>
              <span className="section-title">五路走势图</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
                  大路 · 珠盘路 · 大眼仔路 · 小路 · 螳螂路
                </span>
                <Button
                  icon={<Icons.Reload />}
                  size="small"
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                />
              </div>
            </div>
            <div style={{ padding: '8px 12px 12px' }}>
              {/* 乐观UI：立即渲染，无骨架屏 */}
              <FiveRoadChart data={roadData?.roads ?? null} />
            </div>
          </div>

          {/* 本靴进度条 */}
          <div className="data-card">
            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>本靴进度</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  第{systemState?.game_number || 0}局 / 预计50-70局
                </span>
              </div>
              <Progress
                percent={Math.min(100, ((systemState?.game_number || 0) / MAX_GAMES_PER_BOOT) * 100)}
                showInfo={false}
                strokeColor={{ '0%': '#1890ff', '50%': '#722ed1', '100%': '#ff4d4f' }}
                railColor="rgba(48,54,68,0.3)"
                size={['100%', 8]}
              />
              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                {/* 乐观UI：立即渲染统计数据，无骨架屏 */}
                <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(82,196,26,0.05)', border: '1px solid rgba(82,196,26,0.1)' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>总局数</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#73d13d' }}>{stats?.total_games || 0}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.1)' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>准确率</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ffd700' }}>{stats?.accuracy || 0}%</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(255,77,79,0.05)', border: '1px solid rgba(255,77,79,0.1)' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>连续失准</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ff7875' }}>{systemState?.consecutive_errors || 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ====== 右侧面板 ====== */}
        <div className="right-panel" style={{ flex: '1 1 500px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 智能分析板块 */}
          <div className="analysis-card" style={{ minHeight: 'auto' }}>
            <div className="section-header">
              <span style={{ color: '#fadb14' }}><Icons.Bulb /></span>
              <span className="section-title">智能分析</span>
              {analysis && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>置信度</span>
                  <Progress
                    type="circle"
                    percent={(analysis.confidence || 0) * 100}
                    size={34}
                    format={() => `${((analysis.confidence || 0) * 100).toFixed(0)}%`}
                    strokeColor={(analysis.confidence || 0) >= 0.7 ? '#52c41a' : '#faad14'}
                    trailColor="rgba(48,54,68,0.3)"
                    strokeWidth={3}
                    style={{ fontSize: 10 }}
                  />
                  <Tag color={analysis.bet_tier === '保守' ? 'orange' : analysis.bet_tier === '进取' ? 'red' : 'blue'}
                    style={{ borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                    {analysis.bet_tier || '标准'}档
                  </Tag>
                </div>
              )}
            </div>

            {!hasGameData ? (
              // 状态1: 没有游戏数据 -> 等待上传
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'rgba(255,255,255,0.4)' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                  </svg>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>等待数据上传</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 16 }}>
                  系统已就绪，请上传开奖记录开始AI分析
                </div>
                <Button 
                  type="primary" 
                  icon={<Icons.Upload />}
                  onClick={() => navigate(`/upload/${tableId}`)}
                  style={{ borderRadius: 6 }}
                >
                  上传数据
                </Button>
              </div>
            ) : aiAnalyzing ? (
              // 状态2: 有数据且正在分析 -> 显示分析中
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: 28, marginBottom: 12, animation: 'pulse-glow 1.5s infinite', color: '#1890ff' }}><Icons.Robot /></div>
                <div style={{ color: '#1890ff', fontSize: 14, fontWeight: 600 }}>AI三模型正在分析中...</div>
                {/* 三模型进度指示器 */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, marginBottom: 8 }}>
                  {[
                    { name: '庄模型', icon: 'B', color: '#ff4d4f', delay: 0 },
                    { name: '闲模型', icon: 'P', color: '#1890ff', delay: 0.5 },
                    { name: '综合模型', icon: 'AI', color: '#52c41a', delay: 1 },
                  ].map((model, index) => (
                    <div
                      key={model.name}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: `rgba(${model.color === '#ff4d4f' ? '255,77,79' : model.color === '#1890ff' ? '24,144,255' : '82,196,26'}, 0.1)`,
                        border: `1px solid rgba(${model.color === '#ff4d4f' ? '255,77,79' : model.color === '#1890ff' ? '24,144,255' : '82,196,26'}, 0.2)`,
                        animation: `fadeInUp 0.3s ease ${model.delay}s both`,
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: model.color }}>{model.icon}</span>
                      <span style={{ fontSize: 10, color: model.color, fontWeight: 600 }}>{model.name}</span>
                      <div
                        style={{
                          width: 40,
                          height: 3,
                          borderRadius: 2,
                          background: 'rgba(255,255,255,0.1)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            background: model.color,
                            animation: `shimmer 1.5s ease-in-out ${model.delay}s infinite`,
                            transformOrigin: 'left',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 8 }}>
                  正在并行调用 OpenAI · Claude · Gemini
                </div>
              </div>
            ) : !analysis ? (
              // 状态3: 有数据但没有分析结果 -> 准备分析
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'rgba(255,255,255,0.4)' }}>
                <div style={{ fontSize: 32, marginBottom: 12, animation: 'pulse-glow 2s infinite', color: '#52c41a' }}><Icons.Robot /></div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>数据已就绪</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
                  已上传 {games.length} 局记录，正在准备AI分析...
                </div>
              </div>
            ) : (
              <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* 庄模型 */}
                <div className="model-block model-block-banker">
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                    <span className="model-icon-badge" style={{ color: '#ff4d4f', fontWeight: 700 }}>B</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#ff4d4f' }}>庄模型</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,77,79,0.5)', background: 'rgba(255,77,79,0.08)', padding: '1px 8px', borderRadius: 8 }}>
                      OpenAI GPT-4o mini
                    </span>
                  </div>
                  <p className="analysis-text">{analysis.banker_summary || '暂无庄向分析...'}</p>
                </div>

                {/* 闲模型 */}
                <div className="model-block model-block-player">
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                    <span className="model-icon-badge" style={{ color: '#1890ff', fontWeight: 700 }}>P</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1890ff' }}>闲模型</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(24,144,255,0.5)', background: 'rgba(24,144,255,0.08)', padding: '1px 8px', borderRadius: 8 }}>
                      Claude Sonnet 4
                    </span>
                  </div>
                  <p className="analysis-text">{analysis.player_summary || '暂无闲向分析...'}</p>
                </div>

                {/* 综合模型 */}
                <div className="model-block model-block-combined" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                    <span className="model-icon-badge" style={{ color: '#52c41a', fontWeight: 700 }}>AI</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#52c41a' }}>综合模型</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(82,196,26,0.5)', background: 'rgba(82,196,26,0.08)', padding: '1px 8px', borderRadius: 8 }}>
                      Gemini Flash
                    </span>
                  </div>
                  <p className="analysis-text" style={{ fontWeight: 500, fontSize: 14 }}>
                    {analysis.combined_summary || '暂无综合分析...'}
                  </p>
                </div>

                {/* 下注按钮 */}
                {analysis.prediction && !hasPendingBet && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <Button
                      type="primary"
                      size="large"
                      onClick={handleOpenBet}
                      style={{
                        background: analysis.prediction === '庄'
                          ? 'linear-gradient(135deg,#ff4d4f,#cf1322)'
                          : 'linear-gradient(135deg,#1890ff,#0050b3)',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: 15,
                        borderRadius: 10,
                        minWidth: 160,
                        boxShadow: analysis.prediction === '庄'
                          ? '0 4px 20px rgba(255,77,79,0.3)'
                          : '0 4px 20px rgba(24,144,255,0.3)',
                      }}
                    >
                      <Icons.Coin /> 下注 {analysis.prediction}（第{systemState?.next_game_number}局）
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 智能警告面板 */}
          {(integrityIssues.length > 0 || abnormalPatterns.length > 0 || alerts.length > 0) && (
            <div className="analysis-card" style={{ minHeight: 'auto' }}>
              <div className="section-header">
                <span style={{ color: '#ff4d4f' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                  </svg>
                </span>
                <span className="section-title">智能检测</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  {integrityIssues.length + abnormalPatterns.length + alerts.length} 项提醒
                </span>
              </div>
              <div style={{ padding: '12px 16px 16px' }}>
                <SmartAlertsPanel
                  integrityIssues={integrityIssues}
                  abnormalPatterns={abnormalPatterns}
                  alerts={alerts}
                  onDismissAlert={removeAlert}
                />
              </div>
            </div>
          )}

          {/* 智能报告 */}
          {games.length > 0 && (
            <SmartReport
              games={games}
              bets={bets}
              stats={stats || null}
              period="daily"
            />
          )}

          {/* 实盘日志 */}
          <div className="data-card" style={{ flex: 1, minHeight: 250, display: 'flex', flexDirection: 'column' }}>
            <div className="data-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#13c2c2' }}><Icons.File /></span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>实盘日志</span>
              </div>
              <Space size="small">
                <Select
                  size="small"
                  value={logCategory}
                  onChange={(v) => { setLogCategory(v); }}
                  options={LOG_CATEGORIES}
                  style={{ width: 100, fontSize: 12 }}
                />
                <Switch
                  size="small"
                  checked={autoScroll}
                  onChange={setAutoScroll}
                  checkedChildren="自动"
                  unCheckedChildren="暂停"
                />
              </Space>
            </div>
            <div className="log-table-wrapper data-card-body">
              {/* 乐观UI：立即渲染日志表格 */}
              <LogTable data={logs} scrollY={200} />
            </div>
          </div>

          {/* 底部：下注记录 + 开奖记录 */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div className="data-card" style={{ flex: '1 1 280px', minWidth: 0 }}>
              <div className="data-card-header">
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}><Icons.Coin /> 下注记录</span>
              </div>
              <div className="data-card-body">
                {/* 乐观UI：立即渲染下注记录 */}
                <BetTable
                  data={bets}
                  page={betPage}
                  total={betsTotal}
                  onPageChange={setBetPage}
                />
              </div>
            </div>

            <div className="data-card" style={{ flex: '1 1 280px', minWidth: 0 }}>
              <div className="data-card-header">
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>开奖记录</span>
                <Space size={6}>
                  <span className={`stat-badge-inline ${(stats?.accuracy || 0) >= 55 ? 'stat-accuracy-high' : (stats?.accuracy || 0) >= 45 ? 'stat-accuracy-mid' : 'stat-accuracy-low'}`}>
                    <Icons.Fire />
                    {(stats?.accuracy || 0).toFixed(1)}%
                  </span>
                </Space>
              </div>
              <div className="data-card-body">
                {/* 乐观UI：立即渲染开奖记录 */}
                <GameTable
                  data={games}
                  page={gamePage}
                  total={gamesTotal}
                  onPageChange={setGamePage}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ====== 开奖弹窗 ====== */}
      <RevealModal
        visible={revealVisible}
        onCancel={() => setRevealVisible(false)}
        result={revealResult}
        setResult={setRevealResult}
        onConfirm={handleConfirmReveal}
        loading={revealLoading}
        gameNumber={pendingGameNumber}
      />

      {/* ====== 下注弹窗 ====== */}
      <BetModal
        visible={betVisible}
        onCancel={() => setBetVisible(false)}
        betDirection={betDirection}
        setBetDirection={setBetDirection}
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        onConfirm={handleConfirmBet}
        loading={betLoading}
        balance={systemState?.balance || 0}
        analysis={analysis ? {
          prediction: analysis.prediction,
          confidence: analysis.confidence,
          bet_tier: analysis.bet_tier,
          bet_amount: analysis.bet_amount,
        } : null}
      />

      {/* ====== 管理员登录弹窗 ====== */}
      <LoginModal
        visible={loginVisible}
        onCancel={closeLogin}
        password={loginPassword}
        setPassword={setLoginPassword}
        onLogin={handleAdminLogin}
        loading={loginLoading}
      />

    </div>
  );
};

export default DashboardPage;
