/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 主仪表盘页面 - 智能AI（自动下注模式）
 * 流程：上传数据 → AI预测 → 自动下注 → 等待开奖 → 输入结果 → 结算 → 预测下一局
 *
 * 优化：乐观UI策略 - 数据立即显示，后台静默刷新，零等待体验
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Progress } from 'antd';
import { getToken } from '../services/api';
import type { HealthScoreResponse } from '../services/api';
import type { GameRecord } from '../hooks/useGameState';
import { MAX_GAMES_PER_BOOT, DEFAULT_BET_AMOUNT } from '../utils/constants';
import { RevealModal, LoginModal, DashboardHeader, WorkflowStatusBar, AnalysisPanel } from '../components/dashboard';
import { FiveRoadChart } from '../components/roads';
import { GameTable, BetTable, LogTable } from '../components/tables';
import { LearningStatusPanel } from '../components/learning';
import { SmartAlerts } from '../components/ui';
import {
  useAdminLogin,
  useSmartDetection,
  useSystemDiagnostics,
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
  useUpdateAnalysisOptimistically,
} from '../hooks';
import * as api from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';

const DashboardPage: React.FC = () => {
  
  // navigate暂未使用，保留以备后续路由跳转
  void useNavigate;
  const queryClient = useQueryClient();

  // 系统实时诊断
  const { diagnostics, dismissIssue, retryConnection, addIssue } = useSystemDiagnostics({});

  const [gamePage, setGamePage] = useState(1);
  const [betPage, setBetPage] = useState(1);

  // React Query 数据获取（乐观UI）
  const { data: systemState } = useSystemStateQuery({});
  const { data: stats } = useStatsQuery({});
  const { data: analysis, isFetching: analysisFetching } = useAnalysisQuery({});
  const { data: logsData } = useLogsQuery({ pageSize: 50 });
  const { data: gamesData } = useGamesQuery({ page: gamePage });
  const { data: betsData } = useBetsQuery({ page: betPage });
  const { data: roadData } = useRoadsQuery({});

  const logs = logsData?.logs || [];
  const games = gamesData?.games || [];
  const bets = betsData?.bets || [];
  const gamesTotal = gamesData?.total || 0;
  const betsTotal = betsData?.total || 0;

  // AI分析状态
  const hasGameData = games.length > 0;
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  useEffect(() => {
    if (hasGameData && analysisFetching) {
      setAiAnalyzing(true);
    } else if (!hasGameData) {
      setAiAnalyzing(false);
    } else if (analysis) {
      setAiAnalyzing(false);
    }
  }, [hasGameData, analysisFetching, analysis]);

  // 自动下注
  const hasAutoBetRef = React.useRef(false);
  const placeBetMutation = usePlaceBetMutation();

  useEffect(() => {
    if (analysis?.prediction && !systemState?.pending_bet && !hasAutoBetRef.current ) {
      const gameNumber = systemState?.next_game_number;
      if (!gameNumber) return;

      hasAutoBetRef.current = true;

      const timer = setTimeout(async () => {
        try {
          await placeBetMutation.mutateAsync({
            
            direction: analysis.prediction as '庄' | '闲',
            amount: DEFAULT_BET_AMOUNT,
          });
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : '自动下注失败';
          addIssue({
            level: 'critical',
            title: '自动下注失败',
            detail: `第${gameNumber}局自动下注失败: ${errorMsg}`,
            source: 'system',
          });
          hasAutoBetRef.current = false;
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [analysis, systemState?.pending_bet, systemState?.next_game_number, placeBetMutation, addIssue]);

  useEffect(() => {
    if (hasGameData && !analysis) {
      hasAutoBetRef.current = false;
    }
  }, [hasGameData, analysis]);

  // 智能检测
  const { integrityIssues, abnormalPatterns, bettingAdvice, alerts, removeAlert, markSynced } = useSmartDetection({
    games,
    bets,
    systemState: systemState || null,
    
  });


  useEffect(() => {
    if (games.length > 0 || bets.length > 0) {
      markSynced();
    }
  }, [games.length, bets.length, markSynced]);

  // Mutations
  const revealResultMutation = useRevealResultMutation();

  // 乐观更新函数
  const addLogOptimistically = useAddLogOptimistically();
  const addBetOptimistically = useAddBetOptimistically();
  const updateBetOptimistically = useUpdateBetOptimistically();
  const addGameOptimistically = useAddGameOptimistically();
  const updateRoadsOptimistically = useUpdateRoadsOptimistically();
  const updateStateOptimistically = useUpdateStateOptimistically();
  const updateAnalysisOptimistically = useUpdateAnalysisOptimistically();

  // 页面可见性变化时刷新数据（从上传页面返回时）
  useEffect(() => {
    
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 页面重新可见时刷新所有数据
        queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });
        queryClient.invalidateQueries({ queryKey: queryKeys.roads() });
        queryClient.invalidateQueries({ queryKey: ['games'] });
        queryClient.invalidateQueries({ queryKey: queryKeys.analysis() });
        queryClient.invalidateQueries({ queryKey: queryKeys.stats() });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [ queryClient]);

  // WebSocket
  useEffect(() => {
    

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connectWS = () => {
      if (isUnmounted) return;
      try {
        const ws = api.createWebSocket();

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const { type, data } = msg;

            switch (type) {
              case 'log':
                if (data) {
                  addLogOptimistically( data);
                  queryClient.invalidateQueries({ queryKey: ['logs'] });
                }
                break;
              case 'bet_placed':
                if (data) {
                  addBetOptimistically( {
                    game_number: data.game_number,
                    bet_direction: data.direction,
                    bet_amount: data.amount,
                    bet_tier: data.tier,
                    status: data.status,
                    balance_before: data.balance_after + data.amount,
                    balance_after: data.balance_after,
                    bet_time: new Date().toISOString(),
                    game_result: null,
                    error_id: null,
                    settlement_amount: null,
                    profit_loss: null,
                    adapt_summary: null,
                  });
                  updateStateOptimistically( {
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
                  queryClient.invalidateQueries({ queryKey: ['bets'] });
                  queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });
                }
                break;
              case 'game_revealed':
                if (data) {
                  addGameOptimistically({
                    game_number: data.game_number,
                    result: data.result,
                  } as unknown as GameRecord);
                  queryClient.invalidateQueries({ queryKey: ['games'] });
                  queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });
                }
                break;
              case 'micro_learning':
                setMicroLearning(data);
                break;
              case 'deep_learning_started':
              case 'deep_learning_progress':
              case 'deep_learning_completed':
              case 'deep_learning_failed':
                setDeepLearning(data);
                if (data.status === '完成' || data.status === '失败') {
                  queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });
                }
                break;
              case 'state_update':
                if (data) {
                  updateStateOptimistically( {
                    status: data.status,
                    boot_number: data.boot_number,
                    game_number: data.game_number,
                  });
                  queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });
                }
                break;
            }
          } catch {
            // 忽略解析错误
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
  }, [ addLogOptimistically, addBetOptimistically, updateBetOptimistically, addGameOptimistically, updateRoadsOptimistically, updateStateOptimistically, updateAnalysisOptimistically, queryClient]);

  // 等待开奖计时器
  const hasPendingBet = !!systemState?.pending_bet;
  // pendingGameNumber暂未使用
  void systemState?.pending_bet?.game_number;

  // 开奖弹窗
  const [revealVisible, setRevealVisible] = useState(false);
  const [revealResult, setRevealResult] = useState<'庄' | '闲' | '和' | ''>('');
  const [revealLoading, setRevealLoading] = useState(false);

  // 管理员登录
  const { visible: loginVisible, password: loginPassword, loading: loginLoading, openLogin, closeLogin, setPassword: setLoginPassword, handleLogin: handleAdminLogin } = useAdminLogin();

  // 学习状态
  const [microLearning, setMicroLearning] = useState<any>(null);
  const [deepLearning, setDeepLearning] = useState<any>(null);

  const handleOpenReveal = () => {
    setRevealResult('');
    setRevealVisible(true);
  };

  const handleConfirmReveal = async () => {
    if (!revealResult) return;
    const gameNumber = systemState?.pending_bet?.game_number ?? systemState?.next_game_number;
    if (!gameNumber) return;

    setRevealLoading(true);
    try {
      await revealResultMutation.mutateAsync({  result: revealResult });
      setRevealVisible(false);
      setAiAnalyzing(true);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '开奖失败';
      addIssue({
        level: 'critical',
        title: '开奖失败',
        detail: `第${gameNumber}局开奖失败: ${errorMsg}`,
        source: 'system',
      });
    } finally {
      setRevealLoading(false);
    }
  };

  const isLoggedIn = !!getToken();

  return (
    <div className="dashboard-container">
      {/* 顶部状态栏 */}
      <DashboardHeader
        systemState={{
          ...systemState,
          current_game_result: games.length > 0 ? games[0].result : null,
          game_number: games.length > 0 ? games[0].game_number : 0,
        }}
        bettingAdvice={bettingAdvice}
        diagnostics={diagnostics}
        onDismissIssue={dismissIssue}
        onRetryConnection={retryConnection}
        isLoggedIn={isLoggedIn}
        onOpenLogin={openLogin}
        gameCount={games.length}
      />

      {/* 工作流状态栏 */}
      <WorkflowStatusBar
        hasPendingBet={hasPendingBet}
        hasGameData={hasGameData}
        analysis={analysis ?? null}
        systemState={systemState ?? null}
        onOpenReveal={handleOpenReveal}
      />

      {/* 主体内容 */}
      <div className="dashboard-main-grid" style={{ padding: 16, display: 'flex', gap: 16, flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
        {/* 左侧：五路走势图 */}
        <div style={{ flex: '1 1 500px', minWidth: 'min(300px, 100%)', maxWidth: '100%', boxSizing: 'border-box' }}>
          <div className="road-card" style={{ background: '#1a1d24', borderRadius: 12, padding: 16, marginBottom: 16, overflow: 'hidden', minHeight: 400 }}>
            <div className="section-header" style={{ marginBottom: 12 }}>
              <span style={{ color: '#58a6ff' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>
              </span>
              <span className="section-title">五路走势</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                第{systemState?.boot_number || 1}靴 · 已{systemState?.game_number || 0}局
              </span>
            </div>
            <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
              <FiveRoadChart data={roadData?.roads ?? null} />
            </div>
          </div>

          {/* 本靴进度 */}
          <div className="progress-card" style={{ background: '#1a1d24', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>本靴进度</span>
              <span style={{ fontSize: 12, color: '#ffd700' }}>{games.length} / {MAX_GAMES_PER_BOOT} 局</span>
            </div>
            <Progress
              percent={(games.length / MAX_GAMES_PER_BOOT) * 100}
              showInfo={false}
              strokeColor={{ '0%': '#ffd700', '100%': '#ff8c00' }}
              railColor="rgba(255,255,255,0.1)"
              size="small"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11 }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                命中: <span style={{ color: '#52c41a' }}>{stats?.hit_count || 0}</span>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                失误: <span style={{ color: '#ff4d4f' }}>{stats?.miss_count || 0}</span>
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                胜率: <span style={{ color: '#ffd700' }}>{((stats?.accuracy || 0) * 100).toFixed(1)}%</span>
              </span>
            </div>
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>当前AI模型版本</span>
              <span style={{ fontSize: 12, color: '#b37feb', background: 'rgba(179,127,235,0.1)', padding: '2px 8px', borderRadius: 12 }}>
                {systemState?.current_model_version || 'v1.0'}
              </span>
            </div>
          </div>

          {/* AI学习状态 */}
          <LearningStatusPanel microLearning={microLearning} deepLearning={deepLearning} systemStatus={systemState?.status} compact />
        </div>

        {/* 右侧：分析面板 + 数据表格 */}
        <div style={{ flex: '1 1 400px', minWidth: 'min(300px, 100%)', maxWidth: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 智能分析 */}
          <AnalysisPanel
            analysis={analysis ?? null}
            hasGameData={hasGameData}
            aiAnalyzing={aiAnalyzing}
            
          />

          {/* 智能提示 */}
          <SmartAlerts
            alerts={alerts}
            integrityIssues={integrityIssues}
            abnormalPatterns={abnormalPatterns}
            onDismiss={removeAlert}
          />

          {/* 数据表格 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
            <GameTable
              data={games}
              page={gamePage}
              total={gamesTotal}
              onPageChange={setGamePage}
            />
            <BetTable
              data={bets}
              page={betPage}
              total={betsTotal}
              onPageChange={setBetPage}
            />
          </div>

          {/* 系统日志 */}
          <LogTable data={logs} />
        </div>
      </div>

      {/* 弹窗 */}
      <RevealModal visible={revealVisible} onCancel={() => setRevealVisible(false)} result={revealResult} setResult={setRevealResult} onConfirm={handleConfirmReveal} loading={revealLoading} gameNumber={systemState?.pending_bet?.game_number ?? systemState?.next_game_number} />
      <LoginModal visible={loginVisible} onCancel={closeLogin} password={loginPassword} setPassword={setLoginPassword} onLogin={handleAdminLogin} loading={loginLoading} />
    </div>
  );
};

export default DashboardPage;
