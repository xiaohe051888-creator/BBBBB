/**
 * 主仪表盘页面 - 百家乐分析预测系统
 * 设计风格：奢华赌场风格 + 现代极简主义
 * 布局：顶部状态栏 + 智能分析 + 五路走势图 + 实盘日志 + 数据记录区
 * 
 * 文档规范遵循：
 * - 09-前端信息架构.md：顶部关键信息卡、智能分析板块、五路图、日志展示
 * - 20-智能分析板块实施与文案模板.md：三模型输出格式、一致性约束
 * - 12-前端用户体验规范.md：小白可见可懂、全中文
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Statistic, Table, Tag, Space,
  Badge, Tooltip, Segmented, Empty, message, Modal, Progress, Select, Switch, Tabs,
} from 'antd';
import {
  StopOutlined, ReloadOutlined, ExclamationCircleOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ClockCircleOutlined,
  DashboardOutlined, FileTextOutlined, ThunderboltOutlined,
  SafetyOutlined, ExportOutlined, GlobalOutlined, ApartmentOutlined,
  CheckCircleOutlined, WarningOutlined, EyeOutlined, RobotOutlined,
  ExperimentOutlined, LineChartOutlined, FireOutlined, BulbOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import * as api from '../services/api';
import {
  STATUS_TEXTS, PRIORITY_COLORS, LOG_CATEGORIES,
  BET_STATUS_COLORS, EMPTY_STATES, DIALOG_TEXTS, BUTTON_TEXTS,
} from '../utils/constants';
import FiveRoadChart from '../components/roads/FiveRoadChart';

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
  consistency_status: string;
}

interface CrawlerData {
  status: api.CrawlerStatus | null;
  lastTest: api.CrawlerTestResult | null;
  rawHistory: any[];
  loading: boolean;
  testing: boolean;
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
  const [logPage, setLogPage] = useState(1);
  const [gamePage, setGamePage] = useState(1);
  const [betPage, setBetPage] = useState(1);
  const [logCategory, setLogCategory] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState('analysis');
  
  // 计时器
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  
  // WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 采集状态
  const [crawler, setCrawler] = useState<CrawlerData>({
    status: null,
    lastTest: null,
    rawHistory: [],
    loading: false,
    testing: false,
  });

  // ====== 数据加载方法 ======

  const loadSystemState = useCallback(async () => {
    if (!tableId) return;
    try {
      const res = await api.getSystemState(tableId);
      setSystemState(res.data);
    } catch {}
  }, [tableId]);

  const loadStats = useCallback(async () => {
    if (!tableId) return;
    try {
      const res = await api.getStatistics(tableId);
      setStats(res.data);
    } catch {}
  }, [tableId]);

  const loadLogs = useCallback(async (page = 1) => {
    if (!tableId) return;
    try {
      const res = await api.getLogs({ table_id: tableId, category: logCategory || undefined, page, page_size: 50 });
      setLogs(res.data.data);
    } catch {}
  }, [tableId, logCategory]);

  const loadGames = useCallback(async (page = 1) => {
    if (!tableId) return;
    try {
      const res = await api.getGameRecords({ table_id: tableId, page, page_size: 20 });
      setGames(res.data.data);
      if (typeof res.data.total === 'number') setGamesTotal(res.data.total);
    } catch {}
  }, [tableId]);

  const loadBets = useCallback(async (page = 1) => {
    if (!tableId) return;
    try {
      const res = await api.getBetRecords({ table_id: tableId, page, page_size: 20 });
      setBets(res.data.data);
      if (typeof res.data.total === 'number') setBetsTotal(res.data.total);
    } catch {}
  }, [tableId]);

  const loadRoadData = useCallback(async () => {
    if (!tableId) return;
    setRoadLoading(true);
    try {
      const res = await api.getRoadMaps(tableId);
      if (res.data && (res.data as any).roads) {
        setRoadData(res.data as api.FiveRoadsResponse);
      }
    } catch {
      setRoadData(null);
    } finally {
      setRoadLoading(false);
    }
  }, [tableId]);

  const loadCrawlerStatus = useCallback(async () => {
    if (!tableId) return;
    try {
      const res = await api.getCrawlerStatus(tableId);
      setCrawler(prev => ({ ...prev, status: res.data }));
    } catch {}
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
          consistency_status: 'normal',
        });
      }
    } catch {}
  }, [tableId]);

  // 手动测试采集
  const handleTestCrawler = async () => {
    if (!tableId) return;
    setCrawler(prev => ({ ...prev, testing: true }));
    try {
      const res = await api.testCrawler(tableId);
      setCrawler(prev => ({
        ...prev,
        lastTest: res.data,
        testing: false,
      }));
      if (res.data.success && res.data.data) {
        message.success(`采集成功！第${res.data.data.game_number}局 ${res.data.data.result}`);
      } else if (!res.data.success) {
        message.warning(`采集完成但无新局数据`);
      } else {
        message.error(`采集失败：${res.data.error}`);
      }
    } catch (e: any) {
      message.error('采集测试失败');
      setCrawler(prev => ({ ...prev, testing: false }));
    }
  };

  // ====== 初始化加载 ======

  useEffect(() => {
    loadSystemState();
    loadStats();
    loadLogs();
    loadGames();
    loadBets();
    loadRoadData();
    loadCrawlerStatus();
    loadLatestAnalysis();
  }, [loadSystemState, loadStats, loadLogs, loadGames, loadBets, loadRoadData, loadCrawlerStatus, loadLatestAnalysis]);

  // 走势图定时刷新
  useEffect(() => {
    const interval = setInterval(() => { loadRoadData(); }, 10000);
    return () => clearInterval(interval);
  }, [loadRoadData]);

  // 系统状态定时刷新
  useEffect(() => {
    const interval = setInterval(() => {
      loadSystemState();
      loadStats();
      loadLogs(logPage);
      loadCrawlerStatus();
      loadLatestAnalysis();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadSystemState, loadStats, loadLogs, logPage, loadCrawlerStatus, loadLatestAnalysis]);

  // 工作流计时器
  useEffect(() => {
    if (systemState?.status === '运行中') {
      setTimer(0);
      timerRef.current = setInterval(() => {
        setTimer(prev => prev >= 150 ? prev : prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [systemState?.status]);

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
            if (data.type === 'state_update') setSystemState(data.data);
            else if (data.type === 'log') loadLogs(1);
            else if (data.type === 'analysis') setAnalysis(data.data);
          } catch (e) { /* ignore */ }
        };
        
        ws.onerror = () => console.warn('WebSocket连接错误');
        
        ws.onclose = () => {
          if (!isUnmounted) {
            reconnectTimer = setTimeout(connectWS, 3000);
          }
        };
      } catch (e) {
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
        wsRef.current.onclose = null; // 阻止close事件触发重连
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [tableId, loadLogs]);

  // 操作方法
  const handleStop = () => {
    Modal.confirm({
      ...DIALOG_TEXTS.stopConfirm,
      onOk: async () => {
        try {
          await api.stopSystem(tableId!);
          message.success('系统已停止');
        } catch (error: any) {
          // 停止失败（如系统未在运行），仅提示但不阻止返回
          message.warning(error.response?.data?.detail || error.message);
        }
        navigate('/');
      },
    });
  };

  // 返回选桌页面
  const handleBackToSelect = () => {
    navigate('/');
  };

  // 状态信息
  const statusInfo = systemState ? STATUS_TEXTS[systemState.status] || STATUS_TEXTS.stopped : STATUS_TEXTS.stopped;

  // 表格列定义
  const gameColumns: ColumnsType<GameRecord> = [
    { title: '局号', dataIndex: 'game_number', width: 60 },
    {
      title: '开奖结果', dataIndex: 'result', width: 80,
      render: (v: string) => (
        <Tag color={v === '庄' ? '#ff4d4f' : v === '闲' ? '#1890ff' : '#52c41a'} style={{ fontWeight: 600 }}>{v}</Tag>
      ),
    },
    { title: '预测', dataIndex: 'predict_direction', width: 60 },
    {
      title: '正确', dataIndex: 'predict_correct', width: 60,
      render: (v: boolean | null) => v === null ? '-' : v ? <Tag color="success">✓</Tag> : <Tag color="error">✗</Tag>,
    },
    {
      title: '盈亏', dataIndex: 'profit_loss', width: 80,
      render: (v: number) => <span style={{ color: v > 0 ? '#ff4d4f' : v < 0 ? '#52c41a' : undefined, fontWeight: 600 }}>{v > 0 ? '+' : ''}{v?.toFixed(0)}</span>,
    },
    { title: '余额', dataIndex: 'balance_after', width: 100, render: (v: number) => v?.toLocaleString() },
  ];

  const betColumns: ColumnsType<BetRecord> = [
    { title: '局号', dataIndex: 'game_number', width: 60 },
    {
      title: '方向', dataIndex: 'bet_direction', width: 60,
      render: (v: string) => <Tag color={v === '庄' ? '#ff4d4f' : '#1890ff'}>{v}</Tag>,
    },
    { title: '金额', dataIndex: 'bet_amount', width: 70 },
    {
      title: '档位', dataIndex: 'bet_tier', width: 60,
      render: (v: string) => <Tag color={v === '保守' ? 'orange' : v === '进取' ? 'red' : 'blue'}>{v}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v: string) => <Tag color={BET_STATUS_COLORS[v]}>{v}</Tag>,
    },
    { title: '结果', dataIndex: 'game_result', width: 60 },
    {
      title: '盈亏', dataIndex: 'profit_loss', width: 80,
      render: (v: number | null) => v !== null ? (
        <span style={{ color: v > 0 ? '#ff4d4f' : v < 0 ? '#52c41a' : undefined, fontWeight: 600 }}>
          {v > 0 ? '+' : ''}{v?.toFixed(0)}
        </span>
      ) : '-',
    },
  ];

  const logColumns: ColumnsType<LogEntry> = [
    {
      title: '时间', dataIndex: 'log_time', width: 70,
      render: (v: string) => v ? dayjs(v).format('HH:mm:ss') : '',
    },
    { title: '局号', dataIndex: 'game_number', width: 50, render: (v: number | null) => v ?? '-' },
    {
      title: '事件', dataIndex: 'event_type', width: 90,
      render: (v: string, record: LogEntry) => (
        <Space size={4}>
          {record.is_pinned && <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
          <span style={{ color: PRIORITY_COLORS[record.priority] || '#1890ff' }}>{v}</span>
        </Space>
      ),
    },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    {
      title: '优先级', dataIndex: 'priority', width: 55,
      render: (v: string) => <Tag color={PRIORITY_COLORS[v]} style={{ fontSize: 11 }}>{v}</Tag>,
    },
  ];

  // ====== 渲染 ======

  return (
    <div className="dashboard-container">
      
      {/* ====== 顶部状态栏（文档09：顶部关键信息卡）====== */}
      <div className="top-status-bar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          
          {/* 左侧：系统状态 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* 系统状态指示 */}
            <div className="info-card-mini">
              <div className="status-indicator-dot" style={{
                backgroundColor: statusInfo.color === '#52c41a' ? '#52c41a' :
                                   statusInfo.color === '#ff4d4f' ? '#ff4d4f' : '#faad14'
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                {statusInfo.text}
              </span>
            </div>

            {/* 桌台信息 */}
            <div className="info-card-mini">
              <GlobalOutlined style={{ fontSize: 15, color: '#58a6ff' }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                <strong style={{ color: '#ffd700', marginRight: 4 }}>{tableId}桌</strong>
                · 第{systemState?.boot_number || 0}靴 · 第{systemState?.game_number || 0}局
              </span>
            </div>

            {/* 模型版本 */}
            <div className="info-card-mini">
              <RobotOutlined style={{ fontSize: 15, color: '#b37feb' }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                {systemState?.current_model_version || 'v1.0'}
              </span>
            </div>
          </div>

          {/* 中间：当前局 & 预测局（文档09核心要求）- 移动端隐藏 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }} className="hide-on-mobile">
            {/* 当前局 */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 12,
              padding: '10px 20px',
              textAlign: 'center',
              minWidth: 160,
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 3 }}>
                🎲 当前局
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>
                第{systemState?.game_number || 0}局
                {systemState?.current_game_result && (
                  <Tag
                    color={systemState.current_game_result === '庄' ? '#ff4d4f' : '#1890ff'}
                    style={{ marginLeft: 10, fontSize: 15, fontWeight: 800, borderRadius: 6 }}
                  >
                    {systemState.current_game_result}
                  </Tag>
                )}
              </div>
            </div>

            {/* 分隔箭头 */}
            <ArrowUpOutlined style={{ fontSize: 18, color: 'rgba(255,215,0,0.5)', rotate: '45deg' }} />

            {/* 预测局 */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(255,215,0,0.02))',
              borderRadius: 12,
              padding: '10px 20px',
              textAlign: 'center',
              minWidth: 180,
              border: '1px solid rgba(255,215,0,0.12)',
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,215,0,0.65)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 3 }}>
                🔮 预测局
              </div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#ffd666' }}>
                第{(systemState?.game_number || 0) + 1}局
                {systemState?.predict_direction && (
                  <Tag
                    color="gold"
                    style={{ marginLeft: 10, fontSize: 15, fontWeight: 800, borderRadius: 6, background: 'linear-gradient(135deg,#ffd700,#f0b90b)' }}
                  >
                    {systemState.predict_direction}
                  </Tag>
                )}
              </div>
            </div>
          </div>

          {/* 右侧：计时器 & 余额 & 健康分 & 操作 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            
            {/* 工作流计时器 */}
            <Tooltip title={`工作流计时 / 150秒上限${timer >= 140 ? ' ⚠️ 即将超时' : ''}`}>
              <div className="timer-ring" style={{ cursor: 'default' }}>
                <svg width="52" height="52">
                  <circle cx="26" cy="26" r="23" fill="none" stroke="rgba(48,54,68,0.5)" strokeWidth="4" />
                  <circle
                    cx="26" cy="26" r="23"
                    fill="none"
                    stroke={
                      timer >= 130 ? '#ff4d4f' :
                      timer >= 100 ? '#faad14' :
                      timer >= 70 ? '#1890ff' : '#52c41a'
                    }
                    strokeWidth="4"
                    strokeDasharray={`${(timer / 150) * 144.5} 144.5`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="timer-value" style={{
                  color: timer >= 130 ? '#ff4d4f' : timer >= 100 ? '#faad14' : '#e6edf3'
                }}>
                  {timer}s
                </span>
              </div>
            </Tooltip>

            {/* 余额 */}
            <div className="info-card-mini">
              <span style={{ fontSize: 18 }}>💰</span>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>余额</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#73d13d' }}>
                  ¥{(systemState?.balance || 20000).toLocaleString()}
                </div>
              </div>
            </div>

            {/* 健康分 */}
            <div className="info-card-mini">
              <SafetyOutlined style={{ fontSize: 15, color:
                (systemState?.health_score ?? 100) >= 85 ? '#52c41a' :
                (systemState?.health_score ?? 100) >= 70 ? '#faad14' : '#ff4d4f'
              }} />
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>健康分</div>
                <div style={{
                  fontSize: 14, fontWeight: 700,
                  color: (systemState?.health_score ?? 100) >= 85 ? '#52c41a' :
                         (systemState?.health_score ?? 100) >= 70 ? '#faad14' : '#ff4d4f'
                }}>
                  {(systemState?.health_score ?? 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* 返回选桌 + 停止按钮 */}
            <Space size={8}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={handleBackToSelect}
                style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}
              >
                返回选桌
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                onClick={handleStop}
                className="btn-stop-danger"
              >
                停止系统
              </Button>
            </Space>
          </div>
        </div>
      </div>

      {/* ====== 采集状态栏 ====== */}
      <div className="crawler-bar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Space size={4}>
              <GlobalOutlined style={{ color: '#58a6ff', fontSize: 14 }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>数据源</span>
              <Tag color={
                crawler.status?.type === 'Lile333Scraper' ? 'blue' :
                crawler.status?.type ? 'orange' : 'default'
              } style={{ margin: 0, fontSize: 12 }}>
                {crawler.status?.type || '未连接'}
              </Tag>
            </Space>

            <Space size={4}>
              <ApartmentOutlined style={{
                color: (crawler.status?.stability_score ?? 0) >= 80 ? '#52c41a' :
                       (crawler.status?.stability_score ?? 0) >= 50 ? '#faad14' : '#ff4d4f',
                fontSize: 13
              }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>稳定性</span>
              <strong style={{
                fontSize: 13,
                color: (crawler.status?.stability_score ?? 0) >= 80 ? '#52c41a' :
                      (crawler.status?.stability_score ?? 0) >= 50 ? '#faad14' : '#ff4d4f',
              }}>
                {(crawler.status?.stability_score ?? 0).toFixed(0)}分
              </strong>
            </Space>

            <Space size={4}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>已采集</span>
              <strong style={{ fontSize: 14, color: '#e6edf3' }}>
                {crawler.status?.cached_count ?? crawler.status?.last_game_number ?? 0}
              </strong>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>局</span>
            </Space>

            <Space size={4}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>成功率</span>
              <strong style={{
                fontSize: 13,
                color: (crawler.status?.success_rate ?? 100) >= 95 ? '#52c41a' :
                      (crawler.status?.success_rate ?? 100) >= 80 ? '#faad14' : '#ff4d4f',
              }}>
                {(crawler.status?.success_rate ?? 100).toFixed(0)}%
              </strong>
            </Space>
          </div>

          <Space>
            <Button
              size="small"
              icon={<ReloadOutlined spin={crawler.testing} />}
              loading={crawler.testing}
              onClick={handleTestCrawler}
              style={{ borderRadius: 8 }}
            >
              手动采集
            </Button>
            {crawler.lastTest && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                上次: +{crawler.lastTest.crawl_time.toFixed(1)}s
                {crawler.lastTest.data?.result && (
                  <Tag color={
                    crawler.lastTest.data.result === '庄' ? '#ff4d4f' :
                    crawler.lastTest.data.result === '闲' ? '#1890ff' : '#52c41a'
                  } style={{ marginLeft: 4, fontSize: 10 }}>
                    {crawler.lastTest.data.result}
                  </Tag>
                )}
              </span>
            )}
          </Space>
        </div>
      </div>

      {/* ====== 主体内容区 ====== */}
      <div className="dashboard-main-grid" style={{ padding: 16, display: 'flex', gap: 16 }}>
        
        {/* ====== 左侧面板（约46%）====== */}
        <div className="left-panel" style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* 五路走势图（文档04+09：五路2D血迹图，国际标准） */}
          <div className="road-chart-card" style={{ minHeight: 420 }}>
            <div className="section-header">
              <LineChartOutlined style={{ color: '#722ed1', fontSize: 18 }} />
              <span className="section-title">📊 五路走势图</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
                  大路 · 珠盘 · 大眼仔 · 小路 · 螳螂
                </span>
              </div>
            </div>
            <div style={{ padding: '8px 12px 12px' }}>
              <FiveRoadChart data={roadData?.roads ?? null} loading={roadLoading} />
            </div>
          </div>

          {/* 本靴进度条（文档09） */}
          <div className="data-card">
            <div style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                  🎯 本靴进度
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  第{systemState?.game_number || 0}局 / 预计50-70局
                </span>
              </div>
              <Progress
                percent={Math.min(100, ((systemState?.game_number || 0) / 60) * 100)}
                showInfo={false}
                strokeColor={{
                  '0%': '#1890ff',
                  '50%': '#722ed1',
                  '100%': '#ff4d4f',
                }}
                railColor='rgba(48,54,68,0.3)'
                size={['100%', 8]}
                style={{ borderRadius: 4 }}
              />
              
              {/* 连续正确/错误统计 */}
              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(82,196,26,0.05)', border: '1px solid rgba(82,196,26,0.1)' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>连续正确</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#73d13d' }}>
                    {systemState?.consecutive_errors === 0 ? stats?.hit_count || 0 : 0}
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(255,77,79,0.05)', border: '1px solid rgba(255,77,79,0.1)' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>连续失准</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ff7875' }}>
                    {systemState?.consecutive_errors || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ====== 右侧主信息区（约54%）====== */}
        <div className="right-panel" style={{ flex: '1 1 500px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* ====== 智能分析板块（文档09+20：首页首屏必须展示）====== */}
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
                    strokeColor={(analysis.confidence || 0) >= 0.7 ? '#52c41a' : (analysis.confidence || 0) >= 0.5 ? '#faad14' : '#ff4d4f'}
                    trailColor='rgba(48,54,68,0.3)'
                    strokeWidth={3}
                    style={{ fontSize: 10 }}
                  />
                  <Tag
                    color={analysis.bet_tier === '保守' ? 'orange' : analysis.bet_tier === '进取' ? 'red' : 'blue'}
                    style={{ borderRadius: 12, fontSize: 11, fontWeight: 600 }}
                  >
                    {analysis.bet_tier || '标准'}档
                  </Tag>
                </div>
              )}
            </div>
            
            {!analysis ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'rgba(255,255,255,0.3)' }}>
                <Empty
                  description={EMPTY_STATES.noData.main}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  styles={{ image: { filter: 'grayscale(1)', opacity: 0.3 } }}
                />
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 8 }}>
                  {EMPTY_STATES.noData.guide}
                </div>
              </div>
            ) : (
              <div style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                
                {/* 庄模型分析（文档05+20：只输出庄向证据链） */}
                <div className="model-block model-block-banker">
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <span className="model-icon-badge">🔴</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#ff4d4f', letterSpacing: 0.3 }}>
                      庄模型
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,77,79,0.5)', background: 'rgba(255,77,79,0.08)', padding: '1px 8px', borderRadius: 8 }}>
                      OpenAI GPT-4o mini
                    </span>
                  </div>
                  <p className="analysis-text">
                    {analysis.banker_summary || '暂无庄向分析...'}
                  </p>
                </div>

                {/* 闲模型分析（文档05+20：只输出闲向证据链） */}
                <div className="model-block model-block-player">
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <span className="model-icon-badge">🔵</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1890ff', letterSpacing: 0.3 }}>
                      闲模型
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(24,144,255,0.5)', background: 'rgba(24,144,255,0.08)', padding: '1px 8px', borderRadius: 8 }}>
                      Claude Sonnet 4
                    </span>
                  </div>
                  <p className="analysis-text">
                    {analysis.player_summary || '暂无闲向分析...'}
                  </p>
                </div>

                {/* 综合模型分析（文档05+20：融合证据输出最终预测） */}
                <div className="model-block model-block-combined" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                    <span className="model-icon-badge">🧠</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#52c41a', letterSpacing: 0.3 }}>
                      综合模型
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(82,196,26,0.5)', background: 'rgba(82,196,26,0.08)', padding: '1px 8px', borderRadius: 8 }}>
                      Gemini Flash
                    </span>
                  </div>
                  <p className="analysis-text" style={{ fontWeight: 500, fontSize: 14 }}>
                    {analysis.combined_summary || '暂无综合分析...'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ====== 实盘日志（文档10+12：分类筛选、复制、自动滚动控制）====== */}
          <div className="data-card" style={{ flex: 1, minHeight: 280, display: 'flex', flexDirection: 'column' }}>
            <div className="data-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileTextOutlined style={{ color: '#13c2c2', fontSize: 15 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>📋 实盘日志</span>
              </div>
              <Space size="small">
                <Select
                  size="small"
                  value={logCategory}
                  onChange={(v) => { setLogCategory(v); setLogPage(1); }}
                  options={LOG_CATEGORIES}
                  style={{ width: 110, fontSize: 12 }}
                />
                <Switch
                  size="small"
                  checked={autoScroll}
                  onChange={setAutoScroll}
                  checkedChildren="🔄 自动"
                  unCheckedChildren="⏸️ 暂停"
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
                scroll={{ y: 210 }}
                locale={{ emptyText: EMPTY_STATES.noData.main }}
                rowClassName={(record) => record.is_pinned ? 'log-pinned-row' : ''}
              />
            </div>
          </div>

          {/* 底部双列：下注记录 + 开奖记录（移动端堆叠） */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {/* 下注记录 */}
            <div className="data-card" style={{ flex: '1 1 300px', minWidth: 0 }}>
              <div className="data-card-header">
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>💰 下注记录</span>
              </div>
              <div className="data-card-body">
                <Table
                  dataSource={bets}
                  columns={betColumns}
                  rowKey={(r, i) => `${r.game_number}-${r.bet_direction}-${i}`}
                  size="small"
                  pagination={{ current: betPage, pageSize: 5, total: betsTotal || bets.length, onChange: setBetPage, size: 'small' }}
                  scroll={{ y: 170 }}
                  locale={{ emptyText: '暂无下注记录' }}
                />
              </div>
            </div>

            {/* 开奖记录 + 统计（文档11） */}
            <div className="data-card" style={{ flex: '1 1 300px', minWidth: 0 }}>
              <div className="data-card-header">
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>🎯 开奖记录</span>
                <Space size={6}>
                  {/* 准确率统计徽章 */}
                  <span className={`stat-badge-inline ${
                    (stats?.accuracy || 0) >= 55 ? 'stat-accuracy-high' :
                    (stats?.accuracy || 0) >= 45 ? 'stat-accuracy-mid' : 'stat-accuracy-low'
                  }`}>
                    <FireOutlined />
                    准确率 {(stats?.accuracy || 0).toFixed(1)}%
                  </span>
                  <span className="stat-badge-inline" style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 12,
                  }}>
                    {stats?.total_games || 0}局 / {stats?.hit_count || 0}中 / {stats?.miss_count || 0}错
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
                  scroll={{ y: 170 }}
                  locale={{ emptyText: '暂无开奖记录' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
