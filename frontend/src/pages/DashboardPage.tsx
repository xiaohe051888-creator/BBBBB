/**
 * 主仪表盘页面 - 百家乐分析预测系统（手动模式）
 * 流程：上传数据 → AI预测 → 用户下注 → 等待开奖 → 输入结果 → 结算 → 预测下一局
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Tag, Space,
  Empty, message, Progress, Select, Switch,
} from 'antd';
import {
  ReloadOutlined,
  ArrowUpOutlined, ClockCircleOutlined,
  FileTextOutlined,
  SafetyOutlined, GlobalOutlined,
  RobotOutlined,
  LineChartOutlined, FireOutlined, BulbOutlined,
  UploadOutlined, LockOutlined, UnlockOutlined,
} from '@ant-design/icons';
import * as api from '../services/api';
import { getToken } from '../services/api';
import { LOG_CATEGORIES, MAX_GAMES_PER_BOOT, DEFAULT_BET_AMOUNT } from '../utils/constants';
import { FiveRoadChart } from '../components/roads';
import { BetModal, RevealModal, LoginModal } from '../components/dashboard';
import { GameTable, BetTable, LogTable } from '../components/tables';
import { useAdminLogin, useGameState, useWaitTimer } from '../hooks';

// ====== 组件定义 ======

const DashboardPage: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  // 使用游戏状态管理 Hook
  const {
    systemState,
    stats,
    analysis,
    aiAnalyzing,
    setAiAnalyzing,
    logs,
    games,
    bets,
    gamesTotal,
    betsTotal,
    gamePage,
    betPage,
    setGamePage,
    setBetPage,
    roadData,
    roadLoading,
    loadRoadData,
    loadGames,
    loadBets,
    loadStats,
    // loadLogs, // 保留但暂时未使用
    loadSystemState,
    // loadLatestAnalysis, // 保留但暂时未使用
  } = useGameState({ tableId });

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
    if (!gameNumber) return;

    setRevealLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await api.revealGame(tableId!, gameNumber, revealResult as any);
      if (res.data.success) {
        const settle = res.data.settlement;
        if (settle && settle.profit_loss !== undefined) {
          if (settle.profit_loss > 0) {
            message.success(`🎉 开奖${revealResult}，命中！+${settle.profit_loss.toFixed(0)}元`);
          } else if (settle.profit_loss < 0) {
            message.error(`😔 开奖${revealResult}，未命中，-${Math.abs(settle.profit_loss).toFixed(0)}元`);
          } else {
            message.info(`🤝 开奖${revealResult}，和局，本金退回`);
          }
        } else {
          message.success(`开奖${revealResult}已记录，AI正在分析下一局...`);
        }
        setRevealVisible(false);
        loadRoadData();
        loadGames(1);
        loadBets(1);
        loadStats();
        loadSystemState();
        setAiAnalyzing(true);
      }
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
    if (!gameNumber) return;

    setBetLoading(true);
    try {
      await api.placeBet(tableId!, gameNumber, betDirection, betAmount);
      message.success(`已下注第${gameNumber}局 ${betDirection} ${betAmount}元`);
      setBetVisible(false);
      loadSystemState();
      loadBets(1);
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

  // 是否有待开奖注单
  const pendingGameNumber = systemState?.pending_bet?.game_number ?? systemState?.next_game_number;

  // ====== 渲染 ======

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
                {systemState?.status || '空闲'}
              </span>
            </div>

            {/* 桌台信息 */}
            <div className="info-card-mini">
              <GlobalOutlined style={{ fontSize: 14, color: '#58a6ff' }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                <strong style={{ color: '#ffd700', marginRight: 4 }}>{tableId}桌</strong>
                · 第{systemState?.boot_number || 0}靴
                · 已{systemState?.game_number || 0}局
              </span>
            </div>

            {/* 模型版本 */}
            <div className="info-card-mini">
              <RobotOutlined style={{ fontSize: 14, color: '#b37feb' }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                {systemState?.current_model_version || 'v1.0'}
              </span>
            </div>
          </div>

          {/* 中间：当前/预测局（仅PC端）*/}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }} className="hide-on-mobile">
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '8px 18px', textAlign: 'center', minWidth: 140 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 2 }}>🎲 当前局</div>
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

            <ArrowUpOutlined style={{ fontSize: 16, color: 'rgba(255,215,0,0.4)', transform: 'rotate(45deg)' }} />

            <div style={{ background: 'linear-gradient(135deg,rgba(255,215,0,0.06),rgba(255,215,0,0.02))', borderRadius: 12, padding: '8px 18px', textAlign: 'center', minWidth: 170, border: '1px solid rgba(255,215,0,0.1)' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,215,0,0.6)', letterSpacing: 1.5, marginBottom: 2 }}>🔮 预测下一局</div>
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

          {/* 右侧：余额 + 健康分 + 操作 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

            {/* 余额 */}
            <div className="info-card-mini">
              <span style={{ fontSize: 17 }}>💰</span>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>余额</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#73d13d' }}>
                  ¥{(systemState?.balance || 20000).toLocaleString()}
                </div>
              </div>
            </div>

            {/* 健康分 */}
            <div className="info-card-mini">
              <SafetyOutlined style={{ fontSize: 14, color: (systemState?.health_score ?? 100) >= 85 ? '#52c41a' : '#faad14' }} />
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>健康分</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: (systemState?.health_score ?? 100) >= 85 ? '#52c41a' : '#faad14' }}>
                  {(systemState?.health_score ?? 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <Space size={8}>
              {/* 返回上传页 */}
              <Button
                icon={<UploadOutlined />}
                onClick={() => navigate('/')}
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)', borderRadius: 8 }}
              >
                上传数据
              </Button>

              {/* 管理员登录/进入 */}
              {getToken() ? (
                <Button
                  icon={<UnlockOutlined />}
                  onClick={() => navigate('/admin')}
                  style={{ background: 'rgba(255,215,0,0.08)', borderColor: 'rgba(255,215,0,0.3)', color: '#ffd700', borderRadius: 8 }}
                >
                  管理员
                </Button>
              ) : (
                <Button
                  icon={<LockOutlined />}
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

      {/* ====== 等待开奖状态栏（有待开奖注单时显示）====== */}
      {hasPendingBet && (
        <div style={{
          padding: '12px 20px',
          background: 'linear-gradient(135deg, rgba(250,173,20,0.12), rgba(250,173,20,0.06))',
          borderBottom: '1px solid rgba(250,173,20,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <ClockCircleOutlined style={{ color: '#faad14', fontSize: 18, animation: 'pulse-glow 1.5s infinite' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#faad14' }}>
              等待第 {pendingGameNumber} 局开奖中
            </span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              已等待 {waitSeconds}秒
            </span>
            {systemState?.pending_bet && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Tag color={systemState.pending_bet.direction === '庄' ? '#ff4d4f' : '#1890ff'} style={{ fontWeight: 700, fontSize: 13 }}>
                  已下注{systemState.pending_bet.direction}
                </Tag>
                <Tag color="gold" style={{ fontWeight: 700 }}>
                  {systemState.pending_bet.amount}元
                </Tag>
                <Tag color="blue">{systemState.pending_bet.tier}档</Tag>
              </div>
            )}
          </div>

          <Button
            type="primary"
            size="large"
            onClick={handleOpenReveal}
            style={{
              background: 'linear-gradient(135deg, #faad14, #f0961a)',
              border: 'none',
              fontWeight: 700,
              fontSize: 15,
              borderRadius: 10,
              boxShadow: '0 4px 20px rgba(250,173,20,0.4)',
              padding: '0 28px',
            }}
          >
            🎯 开奖
          </Button>
        </div>
      )}

      {/* ====== 主体内容区 ====== */}
      <div className="dashboard-main-grid" style={{ padding: 16, display: 'flex', gap: 16 }}>

        {/* ====== 左侧面板 ====== */}
        <div className="left-panel" style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* 五路走势图 */}
          <div className="road-chart-card" style={{ minHeight: 420 }}>
            <div className="section-header">
              <LineChartOutlined style={{ color: '#722ed1', fontSize: 18 }} />
              <span className="section-title">📊 五路走势图</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
                  大路 · 珠盘路 · 大眼仔路 · 小路 · 螳螂路
                </span>
                <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  onClick={loadRoadData}
                  loading={roadLoading}
                  style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                />
              </div>
            </div>
            <div style={{ padding: '8px 12px 12px' }}>
              <FiveRoadChart data={roadData?.roads ?? null} loading={roadLoading} />
            </div>
          </div>

          {/* 本靴进度条 */}
          <div className="data-card">
            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>🎯 本靴进度</span>
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
          <div className="analysis-card" style={{ minHeight: 240 }}>
            <div className="section-header">
              <BulbOutlined style={{ color: '#fadb14', fontSize: 18 }} />
              <span className="section-title">⚡ 智能分析</span>
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

            {aiAnalyzing ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 12, animation: 'pulse-glow 1.5s infinite' }}>🤖</div>
                <div style={{ color: '#1890ff', fontSize: 14, fontWeight: 600 }}>AI三模型正在分析中...</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6 }}>庄模型 · 闲模型 · 综合模型</div>
              </div>
            ) : !analysis ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)' }}>
                <Empty description="暂无分析数据" image={Empty.PRESENTED_IMAGE_SIMPLE}
                  styles={{ image: { filter: 'grayscale(1)', opacity: 0.3 } }} />
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>请先上传开奖记录</div>
              </div>
            ) : (
              <div style={{ padding: '4px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* 庄模型 */}
                <div className="model-block model-block-banker">
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                    <span className="model-icon-badge">🔴</span>
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
                    <span className="model-icon-badge">🔵</span>
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
                    <span className="model-icon-badge">🧠</span>
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
                  <div style={{ marginTop: 8, display: 'flex', gap: 10, justifyContent: 'center' }}>
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
                      💰 下注 {analysis.prediction}（第{systemState?.next_game_number}局）
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 实盘日志 */}
          <div className="data-card" style={{ flex: 1, minHeight: 250, display: 'flex', flexDirection: 'column' }}>
            <div className="data-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileTextOutlined style={{ color: '#13c2c2', fontSize: 14 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>📋 实盘日志</span>
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
                  checkedChildren="🔄 自动"
                  unCheckedChildren="⏸ 暂停"
                />
              </Space>
            </div>
            <div className="log-table-wrapper data-card-body">
              <LogTable data={logs} scrollY={200} />
            </div>
          </div>

          {/* 底部：下注记录 + 开奖记录 */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div className="data-card" style={{ flex: '1 1 280px', minWidth: 0 }}>
              <div className="data-card-header">
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>💰 下注记录</span>
              </div>
              <div className="data-card-body">
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
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>🎯 开奖记录</span>
                <Space size={6}>
                  <span className={`stat-badge-inline ${(stats?.accuracy || 0) >= 55 ? 'stat-accuracy-high' : (stats?.accuracy || 0) >= 45 ? 'stat-accuracy-mid' : 'stat-accuracy-low'}`}>
                    <FireOutlined />
                    {(stats?.accuracy || 0).toFixed(1)}%
                  </span>
                </Space>
              </div>
              <div className="data-card-body">
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
        analysis={analysis}
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
