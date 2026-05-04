/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 主仪表盘页面 - 智能AI（自动下注模式）
 * 流程：上传数据 → AI预测 → 自动下注 → 等待开奖 → 输入结果 → 结算 → 预测下一局
 *
 * 优化：乐观UI策略 - 数据立即显示，后台静默刷新，零等待体验
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Progress, Space, Tag } from 'antd';
import { getToken } from '../services/api';
import { MAX_GAMES_PER_BOOT } from '../utils/constants';
import { RevealModal, DashboardHeader, WorkflowStatusBar, AnalysisPanel } from '../components/dashboard';
import LoginModal from '../components/admin/LoginModal';
import { FiveRoadChart } from '../components/roads';
import { GameTable, BetTable, LogTable } from '../components/tables';
import { LearningStatusPanel } from '../components/learning';
import { SmartAlerts } from '../components/ui';
import { debounce } from 'lodash';
import { AdminAlertsBar } from '../components/dashboard/AdminAlertsBar';
import {
  useSmartDetection,
  useSystemDiagnostics,
  useSystemStateQuery,
  useStatsQuery,
  useLogsQuery,
  useGamesQuery,
  useBetsQuery,
  useRoadsQuery,
  useAnalysisQuery,
  useRevealResultMutation,
  useAddLogOptimistically,
  useAddBetOptimistically,
  useAddGameOptimistically,
  useUpdateStateOptimistically,
  useWebSocket,
} from '../hooks';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';

const DashboardPage: React.FC = () => {

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
  // 修复截断Bug：获取本靴游戏记录时不分页（pageSize设为100），确保计算统计（庄、闲、和）时能涵盖所有 72 局
  const { data: gamesData } = useGamesQuery({ page: 1, pageSize: 100 });
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

  // 余额低位预警 (只在 <= 2000 且 > 0 时提醒一次)
  const [lowBalanceWarned, setLowBalanceWarned] = useState(false);
  useEffect(() => {
    const bal = systemState?.balance;
    if (typeof bal === 'number' && Number.isFinite(bal)) {
      // 当余额大于 2000 时重置警告状态（可能用户刚充了钱）
      if (bal > 2000) {
        if (lowBalanceWarned) {
          setLowBalanceWarned(false);
          dismissIssue('low_balance');
        }
      } 
      // 当余额 <= 2000 且 > 0 时触发一次性警告
      else if (bal <= 2000 && bal > 0 && !lowBalanceWarned) {
        setLowBalanceWarned(true);
        addIssue({
          level: 'warning',
          title: '资金低位预警',
          detail: `当前系统测试余额仅剩 ${bal}，即将触及强平线（0元），建议及时前往右上角【管理员页面】补充资金。`,
          source: 'system',
        });
      }
    }
  }, [systemState?.balance, lowBalanceWarned, addIssue, dismissIssue]);

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
  const addGameOptimistically = useAddGameOptimistically();
  const updateStateOptimistically = useUpdateStateOptimistically();

  // 节流与防抖的缓存失效函数 (避免高频 WebSocket 导致打挂服务器)
  const debouncedInvalidateLogs = useMemo(
    () => debounce(() => queryClient.invalidateQueries({ queryKey: ['logs'] }).catch(console.error), 300),
    [queryClient]
  );

  const debouncedInvalidateBets = useMemo(
    () => debounce(() => queryClient.invalidateQueries({ queryKey: ['bets'] }).catch(console.error), 300),
    [queryClient]
  );

  const debouncedInvalidateGames = useMemo(
    () => debounce(() => queryClient.invalidateQueries({ queryKey: ['games'] }).catch(console.error), 300),
    [queryClient]
  );

  const debouncedInvalidateState = useMemo(
    () => debounce(() => queryClient.invalidateQueries({ queryKey: queryKeys.systemState() }).catch(console.error), 300),
    [queryClient]
  );

  const invalidateOnReconnect = useMemo(
    () => debounce(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.systemState() }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis() }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: queryKeys.roads() }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['logs'] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['bets'] }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['games'] }).catch(console.error);
    }, 200),
    [queryClient]
  );

  // 统一使用强化过的 useWebSocket
  useWebSocket({
    onLog: (data) => {
      addLogOptimistically(data);
      debouncedInvalidateLogs();
    },
    onBetPlaced: (data) => {
      const optimisticId = -Date.now();
      addBetOptimistically({
        id: optimisticId,
        game_number: data.game_number,
        bet_seq: 0,
        bet_direction: data.direction,
        bet_amount: data.amount,
        bet_tier: data.tier,
        status: '待开奖',
        balance_before: data.balance_after + data.amount,
        balance_after: data.balance_after,
        bet_time: new Date().toISOString(),
        game_result: null,
        error_id: null,
        settlement_amount: null,
        profit_loss: null,
        adapt_summary: null,
      });
      // 同步乐观更新系统余额，防止闪烁
      updateStateOptimistically({
        balance: data.balance_after
      });
      debouncedInvalidateBets();
      debouncedInvalidateState();
    },
    onGameRevealed: (data) => {
      if (data?.game_number && data?.result) {
        const settlement = data?.settlement;
        addGameOptimistically({
          game_number: data.game_number,
          result: data.result,
          result_time: new Date().toISOString(),
          predict_direction: data?.predict_direction ?? null,
          predict_correct: data?.predict_correct ?? null,
          error_id: null,
          settlement_status: settlement?.status ?? null,
          profit_loss: typeof settlement?.profit_loss === 'number' ? settlement.profit_loss : 0,
          balance_after: typeof data?.balance === 'number' ? data.balance : 0,
        });
      }
      debouncedInvalidateGames();
      debouncedInvalidateState();
    },
    onStateUpdate: (data) => {
      updateStateOptimistically({
        status: data.status,
        boot_number: data.boot_number,
        game_number: data.game_number,
      });
      debouncedInvalidateState();
    },
    onReconnect: () => {
      invalidateOnReconnect();
    },
  });

  // 页面可见性变化时刷新数据（从上传页面返回时）
  useEffect(() => {
    
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 页面重新可见时刷新所有数据，添加 .catch() 兜底断网异常
        queryClient.invalidateQueries({ queryKey: queryKeys.systemState() }).catch(console.error);
        queryClient.invalidateQueries({ queryKey: queryKeys.roads() }).catch(console.error);
        queryClient.invalidateQueries({ queryKey: ['games'] }).catch(console.error);
        queryClient.invalidateQueries({ queryKey: queryKeys.analysis() }).catch(console.error);
        queryClient.invalidateQueries({ queryKey: queryKeys.stats() }).catch(console.error);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [ queryClient]);

  // 计算庄、闲、和的统计数据 (彻底摒弃空数据、占位符、预测数据)
  const validGames = games.filter(g => ['庄', '闲', '和'].includes(g.result));
  const bankerCount = validGames.filter(g => g.result === '庄').length;
  const playerCount = validGames.filter(g => g.result === '闲').length;
  const tieCount = validGames.filter(g => g.result === '和').length;
  // 严格使用三者之和作为总有效局数，不再相信数据库里可能存在的其他脏记录长度
  const validGamesLength = bankerCount + playerCount + tieCount;

  // 等待开奖计时器
  const hasPendingBet = !!systemState?.pending_bet;
  // pendingGameNumber暂未使用
  void systemState?.pending_bet?.game_number;

  // 开奖弹窗
  const [revealVisible, setRevealVisible] = useState(false);
  const [revealResult, setRevealResult] = useState<'庄' | '闲' | '和' | ''>('');
  const [revealLoading, setRevealLoading] = useState(false);
  const closeReveal = useCallback(() => setRevealVisible(false), []);

  // 管理员登录
  const [loginVisible, setLoginVisible] = useState(false);
  const openLogin = () => setLoginVisible(true);
  const closeLogin = () => setLoginVisible(false);

  // 学习状态
  const [microLearning] = useState<any>(null);
  const [deepLearning] = useState<any>(null);

  const handleOpenReveal = () => {
    if (!getToken()) {
      openLogin();
      return;
    }
    if (systemState?.status === '余额不足') {
      addIssue({
        level: 'critical',
        title: '无法开奖',
        detail: '当前系统余额不足，流程已挂起。请前往右上角管理员页面充值测试资金。',
        source: 'system',
      });
      return;
    }
    if (systemState?.status !== '等待开奖' || !systemState?.pending_bet) {
      addIssue({
        level: 'warning',
        title: '尚未自动下注',
        detail: '系统必须先完成自动下注后才允许开奖。请先上传数据并等待自动分析与下注完成。',
        source: 'system',
      });
      return;
    }
    setRevealResult('');
    setRevealVisible(true);
  };

  const handleConfirmReveal = async () => {
    if (revealLoading) return;
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

      <AdminAlertsBar />

      {/* 主体内容 */}
      <div className="dashboard-main-grid" style={{ padding: 16, display: 'flex', gap: 16, flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
        {/* 左侧：五路走势图 */}
        <div className="left-panel" style={{ flex: '1 1 500px', minWidth: 'min(300px, 100%)', maxWidth: '100%', boxSizing: 'border-box' }}>
          <div className="road-card" style={{ background: '#1a1d24', borderRadius: 12, padding: 16, marginBottom: 16, overflow: 'hidden', minHeight: 400 }}>
            <div className="section-header" style={{ marginBottom: 12, display: 'flex', alignItems: 'center' }}>
              <span style={{ color: '#58a6ff', marginRight: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>
              </span>
              <span className="section-title" style={{ marginRight: 16 }}>五路走势</span>

              {/* 庄闲和统计徽标 */}
              <Space size={8}>
                <Tag color="#ff4d4f" style={{ margin: 0, borderRadius: 12, border: 'none', padding: '0 8px' }}>庄 {bankerCount}</Tag>
                <Tag color="#1890ff" style={{ margin: 0, borderRadius: 12, border: 'none', padding: '0 8px' }}>闲 {playerCount}</Tag>
                <Tag color="#52c41a" style={{ margin: 0, borderRadius: 12, border: 'none', padding: '0 8px' }}>和 {tieCount}</Tag>
              </Space>

              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                第{systemState?.boot_number || 1}靴 · 已开{validGamesLength}局
              </span>
            </div>
            <div className="five-road-scroll-container" style={{ overflowX: 'auto', maxWidth: '100%' }}>
              <FiveRoadChart data={roadData?.roads ?? null} />
            </div>
          </div>

          {/* 本靴进度 */}
          <div className="progress-card" style={{ background: '#1a1d24', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>本靴进度</span>
              <span style={{ fontSize: 12, color: '#ffd700' }}>{validGamesLength} / {MAX_GAMES_PER_BOOT} 局</span>
            </div>
            <Progress
              percent={(validGamesLength / MAX_GAMES_PER_BOOT) * 100}
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
        <div className="right-panel" style={{ flex: '1 1 400px', minWidth: 'min(300px, 100%)', maxWidth: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          <div style={{ paddingBottom: 40 }}>
            <LogTable data={logs} />
          </div>
        </div>
      </div>

      {/* 弹窗 */}
      {(revealVisible || revealLoading) && (
        <RevealModal
          visible={true}
          onCancel={closeReveal}
          result={revealResult}
          setResult={setRevealResult}
          onConfirm={handleConfirmReveal}
          loading={revealLoading}
          gameNumber={systemState?.pending_bet?.game_number ?? systemState?.next_game_number}
        />
      )}
      {loginVisible && <LoginModal visible={true} onCancel={closeLogin} onSuccess={closeLogin} />}
    </div>
  );
};

export default DashboardPage;
