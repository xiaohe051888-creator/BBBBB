/**
 * 主仪表盘页面 - 百家乐分析预测系统
 * 布局：顶部状态栏 + 左侧走势图 + 右侧信息区
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Row, Col, Statistic, Table, Tag, Space,
  Badge, Tooltip, Segmented, Empty, message, Modal, Progress, Select, Switch,
} from 'antd';
import {
  StopOutlined, ReloadOutlined, ExclamationCircleOutlined,
  ArrowUpOutlined, ArrowDownOutlined, ClockCircleOutlined,
  DashboardOutlined, FileTextOutlined, ThunderboltOutlined,
  SafetyOutlined, ExportOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import * as api from '../services/api';
import {
  STATUS_TEXTS, PRIORITY_COLORS, LOG_CATEGORIES,
  BET_STATUS_COLORS, EMPTY_STATES, DIALOG_TEXTS, BUTTON_TEXTS,
} from '../utils/constants';

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
  
  // 分页
  const [logPage, setLogPage] = useState(1);
  const [gamePage, setGamePage] = useState(1);
  const [betPage, setBetPage] = useState(1);
  
  // 筛选
  const [logCategory, setLogCategory] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState(true);
  
  // 计时器
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  
  // WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // ====== 数据加载 ======

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
    } catch {}
  }, [tableId]);

  const loadBets = useCallback(async (page = 1) => {
    if (!tableId) return;
    try {
      const res = await api.getBetRecords({ table_id: tableId, page, page_size: 20 });
      setBets(res.data.data);
    } catch {}
  }, [tableId]);

  useEffect(() => {
    loadSystemState();
    loadStats();
    loadLogs();
    loadGames();
    loadBets();
  }, [loadSystemState, loadStats, loadLogs, loadGames, loadBets]);

  // ====== 定时刷新 ======

  useEffect(() => {
    const interval = setInterval(() => {
      loadSystemState();
      loadStats();
      loadLogs(logPage);
    }, 5000);
    return () => clearInterval(interval);
  }, [loadSystemState, loadStats, loadLogs, logPage]);

  // ====== 工作流计时器 ======

  useEffect(() => {
    if (systemState?.status === '运行中') {
      setTimer(0);
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev >= 150) return prev;
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [systemState?.status]);

  // ====== WebSocket ======

  useEffect(() => {
    if (!tableId) return;
    const ws = api.createWebSocket(tableId);
    wsRef.current = ws;
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'state_update') {
        setSystemState(data.data);
      } else if (data.type === 'log') {
        loadLogs(1);
      } else if (data.type === 'analysis') {
        setAnalysis(data.data);
      }
    };
    
    ws.onclose = () => {
      // 自动重连
      setTimeout(() => {
        const newWs = api.createWebSocket(tableId!);
        wsRef.current = newWs;
      }, 3000);
    };
    
    return () => { ws.close(); };
  }, [tableId]);

  // ====== 操作 ======

  const handleStop = () => {
    Modal.confirm({
      ...DIALOG_TEXTS.stopConfirm,
      onOk: async () => {
        await api.stopSystem(tableId!);
        message.success('系统已停止');
        navigate('/');
      },
    });
  };

  // ====== 状态信息 ======

  const statusInfo = systemState ? STATUS_TEXTS[systemState.status] || STATUS_TEXTS.stopped : STATUS_TEXTS.stopped;

  // ====== 开奖记录表格列 ======

  const gameColumns: ColumnsType<GameRecord> = [
    { title: '局号', dataIndex: 'game_number', width: 60, sorter: (a, b) => a.game_number - b.game_number },
    {
      title: '开奖结果',
      dataIndex: 'result',
      width: 80,
      render: (v: string) => (
        <Tag color={v === '庄' ? '#ff4d4f' : v === '闲' ? '#1890ff' : '#52c41a'} style={{ fontWeight: 600 }}>
          {v}
        </Tag>
      ),
    },
    { title: '预测', dataIndex: 'predict_direction', width: 60 },
    {
      title: '正确',
      dataIndex: 'predict_correct',
      width: 60,
      render: (v: boolean | null) => v === null ? '-' : v ? <Tag color="success">✓</Tag> : <Tag color="error">✗</Tag>,
    },
    {
      title: '盈亏',
      dataIndex: 'profit_loss',
      width: 80,
      sorter: (a, b) => a.profit_loss - b.profit_loss,
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#ff4d4f' : v < 0 ? '#52c41a' : undefined, fontWeight: 600 }}>
          {v > 0 ? '+' : ''}{v?.toFixed(0)}
        </span>
      ),
    },
    { title: '余额', dataIndex: 'balance_after', width: 100, render: (v: number) => v?.toLocaleString() },
  ];

  // ====== 下注记录表格列 ======

  const betColumns: ColumnsType<BetRecord> = [
    { title: '局号', dataIndex: 'game_number', width: 60 },
    {
      title: '方向',
      dataIndex: 'bet_direction',
      width: 60,
      render: (v: string) => <Tag color={v === '庄' ? '#ff4d4f' : '#1890ff'}>{v}</Tag>,
    },
    { title: '金额', dataIndex: 'bet_amount', width: 70 },
    {
      title: '档位',
      dataIndex: 'bet_tier',
      width: 60,
      render: (v: string) => <Tag color={v === '保守' ? 'orange' : v === '进取' ? 'red' : 'blue'}>{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: string) => <Tag color={BET_STATUS_COLORS[v]}>{v}</Tag>,
    },
    { title: '结果', dataIndex: 'game_result', width: 60 },
    {
      title: '盈亏',
      dataIndex: 'profit_loss',
      width: 80,
      render: (v: number | null) => v !== null ? (
        <span style={{ color: v > 0 ? '#ff4d4f' : v < 0 ? '#52c41a' : undefined, fontWeight: 600 }}>
          {v > 0 ? '+' : ''}{v?.toFixed(0)}
        </span>
      ) : '-',
    },
    { title: '余额变动', width: 100, render: (_: any, r: BetRecord) => `${r.balance_before?.toLocaleString()} → ${r.balance_after?.toLocaleString()}` },
  ];

  // ====== 日志表格列 ======

  const logColumns: ColumnsType<LogEntry> = [
    {
      title: '时间',
      dataIndex: 'log_time',
      width: 70,
      render: (v: string) => v ? dayjs(v).format('HH:mm:ss') : '',
    },
    { title: '局号', dataIndex: 'game_number', width: 50, render: (v: number | null) => v ?? '-' },
    {
      title: '事件',
      dataIndex: 'event_type',
      width: 90,
      render: (v: string, record: LogEntry) => (
        <Space size={4}>
          {record.is_pinned && <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
          <span style={{ color: PRIORITY_COLORS[record.priority] || '#1890ff' }}>{v}</span>
        </Space>
      ),
    },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 55,
      render: (v: string) => <Tag color={PRIORITY_COLORS[v]} style={{ fontSize: 11 }}>{v}</Tag>,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {/* ====== 顶部状态栏（约10%高度）====== */}
      <div style={{
        background: 'linear-gradient(135deg, #001529 0%, #003a70 100%)',
        padding: '12px 24px',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        {/* 左侧状态 */}
        <Space size="large">
          <Badge status={statusInfo.color === '#52c41a' ? 'success' : statusInfo.color === '#ff4d4f' ? 'error' : 'processing'} />
          <span>{tableId}桌</span>
          <span>第{systemState?.boot_number || 0}靴</span>
          <span>第{systemState?.game_number || 0}局</span>
          <span>版本 {systemState?.current_model_version || 'v1.0'}</span>
        </Space>

        {/* 中间 - 当前局 & 预测局 */}
        <Space size="large" style={{ fontSize: 16 }}>
          <span>
            当前局：{systemState?.game_number || 0}局
            {systemState?.current_game_result && (
              <Tag color={systemState.current_game_result === '庄' ? '#ff4d4f' : '#1890ff'} style={{ marginLeft: 8, fontSize: 14, fontWeight: 700 }}>
                {systemState.current_game_result}
              </Tag>
            )}
          </span>
          <span style={{ color: '#ffd666' }}>
            预测局：{(systemState?.game_number || 0) + 1}局
            {systemState?.predict_direction && (
              <Tag color="gold" style={{ marginLeft: 8, fontSize: 14, fontWeight: 700 }}>
                {systemState.predict_direction}
              </Tag>
            )}
          </span>
        </Space>

        {/* 右侧 - 计时器 & 余额 & 健康分 */}
        <Space size="large">
          <span style={{
            color: timer >= 120 ? '#ff4d4f' : timer >= 90 ? '#faad14' : '#52c41a',
            fontWeight: 700,
            fontSize: 16,
          }}>
            <ClockCircleOutlined /> {timer}s / 150s
          </span>
          <span>余额：¥{systemState?.balance?.toLocaleString() || '20,000'}</span>
          <span>
            健康分：<span style={{ color: (systemState?.health_score ?? 100) >= 85 ? '#52c41a' : (systemState?.health_score ?? 100) >= 70 ? '#faad14' : '#ff4d4f' }}>
              {systemState?.health_score?.toFixed(0) || '100'}
            </span>
          </span>
          <Button danger icon={<StopOutlined />} onClick={handleStop}>停止系统</Button>
        </Space>
      </div>

      {/* ====== 主体内容 ====== */}
      <div style={{ padding: 16, display: 'flex', gap: 16 }}>
        {/* ====== 左侧：5路走势图区域（约45%宽度）====== */}
        <div style={{ flex: '0 0 45%' }}>
          {/* 5路走势图 */}
          <Card title="五路走势图" size="small" style={{ marginBottom: 16, minHeight: 400 }}>
            <div style={{
              display: 'grid',
              gridTemplateRows: 'repeat(2, 1fr)',
              gap: 12,
            }}>
              {/* 大路 - 占满顶部 */}
              <div style={{
                background: '#0a1628',
                borderRadius: 8,
                padding: 12,
                minHeight: 180,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Empty description="大路 - 等待数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>

              {/* 下方4路 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {['珠盘路', '大眼仔路', '小路', '螳螂路'].map(road => (
                  <div key={road} style={{
                    background: '#0a1628',
                    borderRadius: 8,
                    padding: 8,
                    minHeight: 80,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Empty description={road} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* 本靴进度条 */}
          <Card size="small">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#666' }}>本靴进度</span>
              <span style={{ fontSize: 12, color: '#666' }}>第{systemState?.game_number || 0}局（预计50-70局）</span>
            </div>
            <Progress percent={Math.min(100, ((systemState?.game_number || 0) / 60) * 100)} showInfo={false} />
          </Card>
        </div>

        {/* ====== 右侧主信息区（约55%宽度）====== */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 第一段：智能分析板块（约22%高度）*/}
          <Card
            title={<span><ThunderboltOutlined /> 智能分析</span>}
            size="small"
            style={{ minHeight: 220 }}
          >
            {!analysis ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
                <Empty description={EMPTY_STATES.noData.main} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                <div style={{ fontSize: 12, color: '#bbb' }}>{EMPTY_STATES.noData.guide}</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* 庄模型 */}
                <div style={{ background: '#fff1f0', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid #ff4d4f' }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#ff4d4f', marginBottom: 4 }}>庄模型</div>
                  <div style={{ fontSize: 13, color: '#333' }}>{analysis.banker_summary || '暂无分析'}</div>
                </div>
                {/* 闲模型 */}
                <div style={{ background: '#e6f7ff', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid #1890ff' }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#1890ff', marginBottom: 4 }}>闲模型</div>
                  <div style={{ fontSize: 13, color: '#333' }}>{analysis.player_summary || '暂无分析'}</div>
                </div>
                {/* 综合模型 */}
                <div style={{ background: '#f6ffed', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid #52c41a' }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#52c41a', marginBottom: 4 }}>
                    综合模型
                    <Tag color={analysis.bet_tier === '保守' ? 'orange' : analysis.bet_tier === '进取' ? 'red' : 'blue'} style={{ marginLeft: 8, fontSize: 11 }}>
                      {analysis.bet_tier || '标准'}档
                    </Tag>
                  </div>
                  <div style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>
                    {analysis.combined_summary || '暂无分析'}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* 第二段：实盘日志（约22%高度）*/}
          <Card
            title={<span><FileTextOutlined /> 实盘日志</span>}
            size="small"
            extra={
              <Space size="small">
                <Select
                  size="small"
                  value={logCategory}
                  onChange={(v) => { setLogCategory(v); setLogPage(1); }}
                  options={LOG_CATEGORIES}
                  style={{ width: 100 }}
                />
                <Switch
                  size="small"
                  checked={autoScroll}
                  onChange={setAutoScroll}
                  checkedChildren="自动"
                  unCheckedChildren="停止"
                />
              </Space>
            }
            bodyStyle={{ padding: 0, maxHeight: 240, overflow: 'auto' }}
          >
            <Table
              dataSource={logs}
              columns={logColumns}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ y: 200 }}
              locale={{ emptyText: EMPTY_STATES.noData.main }}
              rowClassName={(record) => record.is_pinned ? 'log-pinned' : ''}
            />
          </Card>

          {/* 第三段：下注记录（约26%高度）*/}
          <Card title={<span>💰 下注记录</span>} size="small">
            <Table
              dataSource={bets}
              columns={betColumns}
              rowKey={(r) => `${r.game_number}-${r.bet_direction}`}
              size="small"
              pagination={{ current: betPage, pageSize: 5, total: 100, onChange: setBetPage, size: 'small' }}
              scroll={{ y: 180 }}
              locale={{ emptyText: '暂无下注记录' }}
            />
          </Card>

          {/* 第四段：开奖记录 & 统计（约30%高度）*/}
          <Card
            title={<span>📊 开奖记录</span>}
            size="small"
            extra={
              <Space>
                <Statistic title="准确率" value={stats?.accuracy || 0} suffix="%" valueStyle={{ fontSize: 14, color: (stats?.accuracy || 0) >= 55 ? '#ff4d4f' : '#52c41a' }} />
                <Statistic title="总/中/错" value={`${stats?.total_games || 0}/${stats?.hit_count || 0}/${stats?.miss_count || 0}`} valueStyle={{ fontSize: 14 }} />
              </Space>
            }
          >
            <Table
              dataSource={games}
              columns={gameColumns}
              rowKey="game_number"
              size="small"
              pagination={{ current: gamePage, pageSize: 5, total: 100, onChange: setGamePage, size: 'small' }}
              scroll={{ y: 180 }}
              locale={{ emptyText: '暂无开奖记录' }}
            />
          </Card>
        </div>
      </div>

      {/* 内联样式 */}
      <style>{`
        .log-pinned {
          background-color: #fff7e6 !important;
        }
        .ant-table-small .ant-table-cell {
          padding: 4px 8px !important;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
};

export default DashboardPage;
