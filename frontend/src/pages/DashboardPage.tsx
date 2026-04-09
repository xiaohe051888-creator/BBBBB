/**
 * 主仪表盘页面 - 百家乐分析预测系统（手动模式）
 * 流程：上传数据 → AI预测 → 用户下注 → 等待开奖 → 输入结果 → 结算 → 预测下一局
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Table, Tag, Space,
  Empty, message, Progress, Select, Switch,
} from 'antd';
import {
  ReloadOutlined, ExclamationCircleOutlined,
  ArrowUpOutlined, ClockCircleOutlined,
  FileTextOutlined,
  SafetyOutlined, GlobalOutlined,
  RobotOutlined,
  LineChartOutlined, FireOutlined, BulbOutlined,
  UploadOutlined, LockOutlined, UnlockOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import * as api from '../services/api';
import { getToken } from '../services/api';
import {
  PRIORITY_COLORS, LOG_CATEGORIES,
  BET_STATUS_COLORS, MAX_GAMES_PER_BOOT, DEFAULT_BET_AMOUNT,
} from '../utils/constants';
import FiveRoadChart from '../components/roads/FiveRoadChart';
import { BetModal, RevealModal, LoginModal } from '../components/dashboard';

// ====== 类型定义 ======

interface SystemState {
  status: string;
  boot_number: number;
  game_number: number;
  current_game_result: string | null;
  predict_direction: string | null;
  predict_confidence: number | null;
  current_model_version: string | null;
  current_bet_tier: string;
  balance: number;
  consecutive_errors: number;
  health_score: number;
  pending_bet: {
    direction: string;
    amount: number;
    tier: string;
    game_number: number;
    time: string | null;
  } | null;
  next_game_number: number;
}

interface LogEntry {
  id: number;
  log_time: string;
  game_number: number | null;
  event_code: string;
  event_type: string;
  event_result: string;
  description: string;
  category: string;
  priority: string;
  is_pinned: boolean;
}

interface GameRecord {
  game_number: number;
  result: string;
  result_time: string | null;
  predict_direction: string | null;
  predict_correct: boolean | null;
  error_id: string | null;
  settlement_status: string | null;
  profit_loss: number;
  balance_after: number;
}

interface BetRecord {
  game_number: number;
  bet_time: string | null;
  bet_direction: string;
  bet_amount: number;
  bet_tier: string;
  status: string;
  game_result: string | null;
  error_id: string | null;
  settlement_amount: number | null;
  profit_loss: number | null;
  balance_before: number;
  balance_after: number;
  adapt_summary: string | null;
}

interface Stats {
  total_games: number;
  hit_count: number;
  miss_count: number;
  accuracy: number;
  balance: number;
}

interface AnalysisData {
  banker_summary: string;
  player_summary: string;
  combined_summary: string;
  confidence: number;
  bet_tier: string;
  prediction: string | null;
  bet_amount: number | null;
}

// ====== 组件定义 ======

const DashboardPage: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  // 系统状态
  const [systemState, setSystemState] = useState<SystemState | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);

  // 数据列表
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [gamesTotal, setGamesTotal] = useState(0);
  const [betsTotal, setBetsTotal] = useState(0);

  // 走势图数据
  const [roadData, setRoadData] = useState<api.FiveRoadsResponse | null>(null);
  const [roadLoading, setRoadLoading] = useState(false);

  // 分页与筛选
  const [logPage] = useState(1);
  const [gamePage, setGamePage] = useState(1);
  const [betPage, setBetPage] = useState(1);
  const [logCategory, setLogCategory] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState(true);

  // 计时器（等待开奖）
  const [waitSeconds, setWaitSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // 开奖弹窗
  const [revealVisible, setRevealVisible] = useState(false);
  const [revealResult, setRevealResult] = useState<'庄' | '闲' | '和' | ''>('');
  const [revealLoading, setRevealLoading] = useState(false);

  // 下注弹窗
  const [betVisible, setBetVisible] = useState(false);
  const [betDirection, setBetDirection] = useState<'庄' | '闲'>('庄');
  const [betAmount, setBetAmount] = useState<number>(DEFAULT_BET_AMOUNT);
  const [betLoading, setBetLoading] = useState(false);

  // 管理员登录弹窗
  const [loginVisible, setLoginVisible] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // AI分析loading状态
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // WebSocket
  const wsRef = useRef<WebSocket | null>(null);

  // ====== 数据加载 ======

  const loadSystemState = useCallback(async () => {
    if (!tableId) return;
    try {
      const res = await api.getSystemState(tableId);
      setSystemState(res.data);
    } catch {
      // 静默处理错误
    }
  }, [tableId]);

  const loadStats = useCallback(async () => {
    if (!tableId) return;
    try {
      const res = await api.getStatistics(tableId);
      setStats(res.data);
    } catch {
      // 静默处理错误
    }
  }, [tableId]);

  const loadLogs = useCallback(async (page = 1) => {
    if (!tableId) return;
    try {
      const res = await api.getLogs({ table_id: tableId, category: logCategory || undefined, page, page_size: 50 });
      setLogs(res.data.data);
    } catch {
      // 静默处理错误
    }
  }, [tableId, logCategory]);

  const loadGames = useCallback(async (page = 1) => {
    if (!tableId) return;
    try {
      const res = await api.getGameRecords({ table_id: tableId, page, page_size: 20 });
      setGames(res.data.data);
      if (typeof res.data.total === 'number') setGamesTotal(res.data.total);
    } catch {
      // 静默处理错误
    }
  }, [tableId]);

  const loadBets = useCallback(async (page = 1) => {
    if (!tableId) return;
    try {
      const res = await api.getBetRecords({ table_id: tableId, page, page_size: 20 });
      setBets(res.data.data);
      if (typeof res.data.total === 'number') setBetsTotal(res.data.total);
    } catch {
      // 静默处理错误
    }
  }, [tableId]);

  const loadRoadData = useCallback(async () => {
    if (!tableId) return;
    setRoadLoading(true);
    try {
      const res = await api.getRoadMaps(tableId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (res.data && (res.data as any).roads) {
        setRoadData(res.data as api.FiveRoadsResponse);
      }
    } catch {
      setRoadData(null);
    } finally {
      setRoadLoading(false);
    }
  }, [tableId]);

  const loadLatestAnalysis = useCallback(async () => {
    if (!tableId) return;
    try {
      const res = await api.getLatestAnalysis(tableId);
      if (res.data && res.data.has_data) {
        setAnalysis({
          banker_summary: res.data.banker_model?.summary || '',
          player_summary: res.data.player_model?.summary || '',
          combined_summary: res.data.combined_model?.summary || '',
          confidence: res.data.combined_model?.confidence || 0.5,
          bet_tier: res.data.combined_model?.bet_tier || '标准',
          prediction: res.data.combined_model?.prediction || null,
          bet_amount: null,
        });
        setAiAnalyzing(false);
      }
    } catch {
      // 静默处理错误
    }
  }, [tableId]);

  // ====== 初始化加载 ======

  useEffect(() => {
    loadSystemState();
    loadStats();
    loadLogs();
    loadGames();
    loadBets();
    loadRoadData();
    loadLatestAnalysis();
  }, [loadSystemState, loadStats, loadLogs, loadGames, loadBets, loadRoadData, loadLatestAnalysis]);

  // 定时刷新（5秒）
  useEffect(() => {
    const interval = setInterval(() => {
      loadSystemState();
      loadStats();
      loadLogs(logPage);
      loadLatestAnalysis();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadSystemState, loadStats, loadLogs, logPage, loadLatestAnalysis]);

  // 走势图刷新（10秒）
  useEffect(() => {
    const interval = setInterval(() => { loadRoadData(); }, 10000);
    return () => clearInterval(interval);
  }, [loadRoadData]);

  // 等待开奖计时器
  useEffect(() => {
    if (systemState?.pending_bet) {
      if (!timerRef.current) {
        setWaitSeconds(0);
        timerRef.current = setInterval(() => {
          setWaitSeconds(prev => prev + 1);
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
        setWaitSeconds(0);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [systemState?.pending_bet]);

  // WebSocket实时连接
  useEffect(() => {
    if (!tableId) return;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connectWS = () => {
      if (isUnmounted) return;
      try {
        const ws = api.createWebSocket(tableId);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'state_update') {
              setSystemState(prev => ({ ...prev, ...data.data }));
            } else if (data.type === 'log') {
              loadLogs(1);
            } else if (data.type === 'analysis') {
              const d = data.data;
              setAnalysis({
                banker_summary: d.banker_summary || '',
                player_summary: d.player_summary || '',
                combined_summary: d.combined_summary || '',
                confidence: d.confidence || 0.5,
                bet_tier: d.bet_tier || '标准',
                prediction: d.predict_direction || null,
                bet_amount: d.bet_amount || null,
              });
              setAiAnalyzing(false);
              loadSystemState();
            } else if (data.type === 'game_revealed') {
              loadRoadData();
              loadGames(1);
              loadBets(1);
              loadStats();
              setAiAnalyzing(true); // 开奖后等待下一局分析
            } else if (data.type === 'bet_placed') {
              loadSystemState();
              loadBets(1);
            }
          } catch {
            // WebSocket消息解析错误，静默处理
          }
        };

        ws.onerror = () => {
          // WebSocket错误，静默处理
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
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [tableId, loadLogs, loadRoadData, loadGames, loadBets, loadStats, loadSystemState]);

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

  // 管理员登录
  const handleAdminLogin = async () => {
    if (!loginPassword) return;
    setLoginLoading(true);
    try {
      const res = await api.adminLogin('admin', loginPassword);
      const { must_change_password, token } = res.data;
      api.setToken(token);
      if (must_change_password) {
        message.warning('首次登录请修改默认密码');
        navigate('/admin', { state: { mustChangePassword: true, token } });
      } else {
        navigate('/admin', { state: { token } });
      }
      setLoginVisible(false);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '登录失败';
      message.error(errorMsg);
    } finally {
      setLoginLoading(false);
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
  const hasPendingBet = !!systemState?.pending_bet;
  const pendingGameNumber = systemState?.pending_bet?.game_number ?? systemState?.next_game_number;

  // 表格列定义
  const gameColumns: ColumnsType<GameRecord> = [
    { title: '局号', dataIndex: 'game_number', width: 60 },
    {
      title: '结果', dataIndex: 'result', width: 70,
      render: (v: string) => (
        <Tag color={v === '庄' ? '#ff4d4f' : v === '闲' ? '#1890ff' : '#52c41a'} style={{ fontWeight: 700 }}>{v}</Tag>
      ),
    },
    { title: '预测', dataIndex: 'predict_direction', width: 60 },
    {
      title: '正确', dataIndex: 'predict_correct', width: 55,
      render: (v: boolean | null) => v === null ? '-' : v ? <Tag color="success">✓</Tag> : <Tag color="error">✗</Tag>,
    },
    {
      title: '盈亏', dataIndex: 'profit_loss', width: 75,
      render: (v: number) => <span style={{ color: v > 0 ? '#ff4d4f' : v < 0 ? '#52c41a' : undefined, fontWeight: 600 }}>{v > 0 ? '+' : ''}{v?.toFixed(0)}</span>,
    },
  ];

  const betColumns: ColumnsType<BetRecord> = [
    { title: '局号', dataIndex: 'game_number', width: 55 },
    {
      title: '方向', dataIndex: 'bet_direction', width: 55,
      render: (v: string) => <Tag color={v === '庄' ? '#ff4d4f' : '#1890ff'}>{v}</Tag>,
    },
    { title: '金额', dataIndex: 'bet_amount', width: 65 },
    {
      title: '状态', dataIndex: 'status', width: 75,
      render: (v: string) => <Tag color={BET_STATUS_COLORS[v]}>{v}</Tag>,
    },
    {
      title: '盈亏', dataIndex: 'profit_loss', width: 75,
      render: (v: number | null) => v !== null ? (
        <span style={{ color: v > 0 ? '#ff4d4f' : v < 0 ? '#52c41a' : undefined, fontWeight: 600 }}>
          {v > 0 ? '+' : ''}{v?.toFixed(0)}
        </span>
      ) : '-',
    },
  ];

  const logColumns: ColumnsType<LogEntry> = [
    {
      title: '时间', dataIndex: 'log_time', width: 65,
      render: (v: string) => v ? dayjs(v).format('HH:mm:ss') : '',
    },
    { title: '局', dataIndex: 'game_number', width: 40, render: (v: number | null) => v ?? '-' },
    {
      title: '事件', dataIndex: 'event_type', width: 90,
      render: (v: string, record: LogEntry) => (
        <Space size={4}>
          {record.is_pinned && <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
          <span style={{ color: PRIORITY_COLORS[record.priority] || '#1890ff', fontSize: 12 }}>{v}</span>
        </Space>
      ),
    },
    { title: '说明', dataIndex: 'description', ellipsis: true, render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span> },
  ];

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
                  onClick={() => setLoginVisible(true)}
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
                  大路 · 珠盘 · 大眼仔 · 小路 · 螳螂
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
              <Table
                dataSource={logs}
                columns={logColumns}
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ y: 200 }}
                locale={{ emptyText: '暂无日志' }}
                rowClassName={(record) => record.is_pinned ? 'log-pinned-row' : ''}
              />
            </div>
          </div>

          {/* 底部：下注记录 + 开奖记录 */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div className="data-card" style={{ flex: '1 1 280px', minWidth: 0 }}>
              <div className="data-card-header">
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>💰 下注记录</span>
              </div>
              <div className="data-card-body">
                <Table
                  dataSource={bets}
                  columns={betColumns}
                  rowKey={(r, i) => `${r.game_number}-${i}`}
                  size="small"
                  pagination={{ current: betPage, pageSize: 5, total: betsTotal || bets.length, onChange: setBetPage, size: 'small' }}
                  scroll={{ y: 160 }}
                  locale={{ emptyText: '暂无记录' }}
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
                <Table
                  dataSource={games}
                  columns={gameColumns}
                  rowKey="game_number"
                  size="small"
                  pagination={{ current: gamePage, pageSize: 5, total: gamesTotal || games.length, onChange: setGamePage, size: 'small' }}
                  scroll={{ y: 160 }}
                  locale={{ emptyText: '暂无记录' }}
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
        onCancel={() => { setLoginVisible(false); setLoginPassword(''); }}
        password={loginPassword}
        setPassword={setLoginPassword}
        onLogin={handleAdminLogin}
        loading={loginLoading}
      />

    </div>
  );
};

export default DashboardPage;
