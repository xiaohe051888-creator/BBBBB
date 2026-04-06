/**
 * 下注记录详情页 - 完整下注历史、统计图表、盈亏分析
 * 路由：/dashboard/:tableId/bets
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Table, Tag, Space, Row, Col, Statistic,
  Select, DatePicker, Input, Tooltip, Modal, Spin, Empty,
  Segmented, Progress, message, Badge, Descriptions,
} from 'antd';
import {
  ArrowLeftOutlined, ReloadOutlined, SearchOutlined,
  FilterOutlined, DownloadOutlined, DollarOutlined,
  RiseOutlined, FallOutlined, QuestionCircleOutlined,
  TrophyOutlined, WarningOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import * as api from '../services/api';
import { BET_STATUS_COLORS, STATUS_TEXTS } from '../utils/constants';

const { RangePicker } = DatePicker;

interface BetRecord {
  id?: number;
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

interface BetSummary {
  totalBets: number;
  totalAmount: number;
  totalPnL: number;
  winCount: number;
  lossCount: number;
  pendingCount: number;
  winRate: number;
  avgBet: number;
  maxWin: number;
  maxLoss: number;
  currentStreak: number;
}

const BetRecordsPage: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  // 数据
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<BetSummary | null>(null);

  // 分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 筛选
  const [filterDirection, setFilterDirection] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterTier, setFilterTier] = useState<string>('');
  const [searchGameNumber, setSearchGameNumber] = useState('');

  // 详情弹窗
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<BetRecord | null>(null);

  // 加载下注记录
  const loadBets = useCallback(async (p = page) => {
    if (!tableId) return;
    setLoading(true);
    try {
      const res = await api.getBetRecords({
        table_id: tableId,
        page: p,
        page_size: pageSize,
      });
      const data = res.data.data || [];
      setBets(data);

      // 计算统计数据
      calcSummary(data);
    } catch {
      // API请求失败时显示空数据（不使用模拟数据）
    } finally {
      setLoading(false);
    }
  }, [tableId, page, pageSize]);

  // 计算汇总数据
  const calcSummary = (data: BetRecord[]) => {
    if (!data.length) return;

    let totalAmount = 0;
    let totalPnL = 0;
    let winCount = 0;
    let lossCount = 0;
    let pendingCount = 0;
    let maxWin = -Infinity;
    let maxLoss = Infinity;

    data.forEach(b => {
      totalAmount += b.bet_amount || 0;
      if (b.profit_loss !== null && b.profit_loss !== undefined) {
        totalPnL += b.profit_loss;
        if (b.profit_loss > 0) { winCount++; maxWin = Math.max(maxWin, b.profit_loss); }
        else if (b.profit_loss < 0) { lossCount++; maxLoss = Math.min(maxLoss, b.profit_loss); }
      }
      if (b.status === '待结算') pendingCount++;
    });

    // 当前连续胜负
    let currentStreak = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      const pl = data[i].profit_loss;
      if (pl === null || pl === undefined) break;
      if (currentStreak === 0) {
        currentStreak = pl > 0 ? 1 : pl < 0 ? -1 : 0;
      } else if ((currentStreak > 0 && pl > 0) || (currentStreak < 0 && pl < 0)) {
        currentStreak += currentStreak > 0 ? 1 : -1;
      } else break;
    }

    setSummary({
      totalBets: data.length,
      totalAmount,
      totalPnL,
      winCount,
      lossCount,
      pendingCount,
      winRate: (winCount + lossCount) > 0 ? winCount / (winCount + lossCount) * 100 : 0,
      avgBet: data.length > 0 ? totalAmount / data.length : 0,
      maxWin: maxWin === -Infinity ? 0 : maxWin,
      maxLoss: maxLoss === Infinity ? 0 : maxLoss,
      currentStreak,
    });
  };

  useEffect(() => {
    loadBets();
  }, [loadBets]);

  // 自动刷新
  useEffect(() => {
    const interval = setInterval(() => loadBets(), 15000);
    return () => clearInterval(interval);
  }, [loadBets]);

  // 筛选后的数据
  const filteredBets = bets.filter(b => {
    if (filterDirection && b.bet_direction !== filterDirection) return false;
    if (filterStatus && b.status !== filterStatus) return false;
    if (filterTier && b.bet_tier !== filterTier) return false;
    if (searchGameNumber && !String(b.game_number).includes(searchGameNumber)) return false;
    return true;
  });

  // 表格列定义
  const columns: ColumnsType<BetRecord> = [
    {
      title: '局号',
      dataIndex: 'game_number',
      width: 60,
      sorter: (a, b) => a.game_number - b.game_number,
    },
    {
      title: '下注方向',
      dataIndex: 'bet_direction',
      width: 80,
      render: (v: string) => (
        <Tag color={v === '庄' ? '#ff4d4f' : '#1890ff'} style={{ fontWeight: 600 }}>
          {v}
        </Tag>
      ),
    },
    {
      title: '金额',
      dataIndex: 'bet_amount',
      width: 80,
      sorter: (a, b) => a.bet_amount - b.bet_amount,
      render: (v: number) => <span style={{ fontWeight: 500 }}>¥{v}</span>,
    },
    {
      title: '档位',
      dataIndex: 'bet_tier',
      width: 65,
      render: (v: string) => (
        <Tag color={v === '保守' ? 'orange' : v === '进取' ? 'red' : 'blue'} style={{ fontSize: 11 }}>
          {v}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 75,
      render: (v: string) => (
        <Tag color={BET_STATUS_COLORS[v]}>{v}</Tag>
      ),
    },
    {
      title: '开奖结果',
      dataIndex: 'game_result',
      width: 75,
      render: (v: string | null) => v
        ? <Tag color={v === '庄' ? '#ff4d4f' : '#1890ff'}>{v}</Tag>
        : '-',
    },
    {
      title: '盈亏',
      dataIndex: 'profit_loss',
      width: 90,
      sorter: (a, b) => (a.profit_loss || 0) - (b.profit_loss || 0),
      render: (v: number | null) =>
        v !== null ? (
          <span style={{
            color: v > 0 ? '#ff4d4f' : v < 0 ? '#52c41a' : undefined,
            fontWeight: 700,
            fontSize: 13,
          }}>
            {v > 0 ? '+' : ''}{v.toFixed(0)}
          </span>
        ) : <span style={{ color: '#888' }}>-</span>,
    },
    {
      title: '余额变动',
      width: 140,
      render: (_: any, r: BetRecord) => (
        <Tooltip title={`${r.balance_before?.toLocaleString()} → ${r.balance_after?.toLocaleString()}`}>
          <span style={{ fontSize: 12 }}>
            ¥{r.balance_before?.toLocaleString()} → ¥{r.balance_after?.toLocaleString()}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      width: 60,
      fixed: 'right' as const,
      render: (_: any, r: BetRecord) => (
        <Button
          type="link"
          size="small"
          onClick={() => { setSelectedBet(r); setDetailModalOpen(true); }}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', padding: 16 }}>
      {/* 顶部导航 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: '1px solid #21262d',
      }}>
        <Space size="middle">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/dashboard/${tableId}`)}>
            返回仪表盘
          </Button>
          <span style={{ color: '#e6edf3', fontSize: 16, fontWeight: 600 }}>
            <DollarOutlined style={{ marginRight: 8 }} />
            下注记录 — {tableId}
          </span>
          <Badge count={filteredBets.length} showZero style={{ backgroundColor: '#58a6ff' }} />
        </Space>

        <Space size="middle">
          <Button icon={<ReloadOutlined />} size="small" onClick={() => loadBets(1)}>
            刷新
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      {summary && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col span={3}>
            <Card size="small">
              <Statistic title="总下注" value={summary.totalBets} suffix="笔" styles={{ content: { fontSize: 18, color: '#58a6ff' } }} />
            </Card>
          </Col>
          <Col span={3}>
            <Card size="small">
              <Statistic title="总投注" value={summary.totalAmount} prefix="¥" styles={{ content: { fontSize: 18 } }} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic
                title="总盈亏"
                value={summary.totalPnL}
                prefix={summary.totalPnL >= 0 ? <RiseOutlined /> : <FallOutlined />}
                styles={{ content: { fontSize: 18, color: summary.totalPnL >= 0 ? '#ff4d4f' : '#52c41a' } }}
              />
            </Card>
          </Col>
          <Col span={3}>
            <Card size="small">
              <Statistic title="胜率" value={summary.winRate.toFixed(1)} suffix="%" styles={{ content: { fontSize: 18, color: summary.winRate >= 50 ? '#ff4d4f' : '#52c41a' } }} />
            </Card>
          </Col>
          <Col span={3}>
            <Card size="small">
              <Statistic title="胜/负/待" value={`${summary.winCount}/${summary.lossCount}/${summary.pendingCount}`} styles={{ content: { fontSize: 14 } }} />
            </Card>
          </Col>
          <Col span={3}>
            <Card size="small">
              <Statistic title="均注" value={Math.round(summary.avgBet)} prefix="¥" styles={{ content: { fontSize: 16 } }} />
            </Card>
          </Col>
          <Col span={3}>
            <Card size="small">
              <Statistic title="最大单赢" value={summary.maxWin} prefix="+" styles={{ content: { fontSize: 16, color: '#ff4d4f' } }} />
            </Card>
          </Col>
          <Col span={2}>
            <Card size="small">
              <Statistic
                title="连胜/连败"
                value={Math.abs(summary.currentStreak)}
                suffix={summary.currentStreak > 0 ? '胜' : summary.currentStreak < 0 ? '败' : '-'}
                styles={{
                  content: {
                    fontSize: 14,
                    color: summary.currentStreak > 2 ? '#ff4d4f' : summary.currentStreak < -2 ? '#52c41a' : undefined,
                  }
                }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 盈亏进度条 */}
      {summary && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row align="middle">
            <Col span={4}>盈亏分布</Col>
            <Col span={14}>
              <Progress
                percent={
                  summary.winCount + summary.lossCount > 0
                    ? (summary.winCount / (summary.winCount + summary.lossCount)) * 100
                    : 0
                }
                success={{ percent: 0 }}
                strokeColor="#ff4d4f"
                trailColor="#52c41a"
                format={(percent) => `${summary.winCount}胜 / ${summary.lossCount}负`}
              />
            </Col>
            <Col span={6} style={{ textAlign: 'right' }}>
              <Space>
                <Tag color="#ff4d4f">胜 {summary.winCount}</Tag>
                <Tag color="#52c41a">负 {summary.lossCount}</Tag>
                <Tag color="#faad14">待 {summary.pendingCount}</Tag>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* 筛选栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <FilterOutlined /> <strong style={{ color: '#8b949e' }}>筛选：</strong>

          <Select
            placeholder="下注方向"
            allowClear
            value={filterDirection || undefined}
            onChange={setFilterDirection}
            style={{ width: 110 }}
            size="small"
            options={[
              { label: '庄', value: '庄' },
              { label: '闲', value: '闲' },
            ]}
          />

          <Select
            placeholder="状态"
            allowClear
            value={filterStatus || undefined}
            onChange={setFilterStatus}
            style={{ width: 100 }}
            size="small"
            options={[
              { label: '已结算', value: '已结算' },
              { label: '待结算', value: '待结算' },
            ]}
          />

          <Select
            placeholder="档位"
            allowClear
            value={filterTier || undefined}
            onChange={setFilterTier}
            style={{ width: 95 }}
            size="small"
            options={[
              { label: '保守', value: '保守' },
              { label: '标准', value: '标准' },
              { label: '进取', value: '进取' },
            ]}
          />

          <Input
            placeholder="搜索局号"
            size="small"
            value={searchGameNumber}
            onChange={(e) => setSearchGameNumber(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 120 }}
          />

          <Button
            size="small"
            onClick={() => {
              setFilterDirection('');
              setFilterStatus('');
              setFilterTier('');
              setSearchGameNumber('');
            }}
          >
            重置
          </Button>

          <span style={{ marginLeft: 24, color: '#8b949e', fontSize: 13 }}>
            共 {filteredBets.length} 条记录
          </span>
        </Space>
      </Card>

      {/* 数据表格 */}
      <Spin spinning={loading}>
        <Card size="small">
          <Table
            dataSource={filteredBets}
            columns={columns}
            rowKey={(r) => `bet-${r.game_number}-${r.bet_direction}`}
            size="small"
            pagination={{
              current: page,
              pageSize,
              total: filteredBets.length,
              onChange: (p, ps) => { setPage(p); if (ps !== pageSize) setPageSize(ps); },
              showTotal: (total) => `共 ${total} 条`,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              size: 'small',
            }}
            scroll={{ x: 900, y: 'calc(100vh - 520px)' }}
            locale={{ emptyText: <Empty description="暂无下注记录" /> }}
            rowClassName={(record) => {
              if (record.status === '待结算') return 'row-pending';
              if (record.profit_loss && record.profit_loss > 0) return 'row-win';
              if (record.profit_loss && record.profit_loss < 0) return 'row-loss';
              return '';
            }}
          />
        </Card>
      </Spin>

      {/* 详情弹窗 */}
      <Modal
        title={`下注详情 - 第${selectedBet?.game_number}局`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>关闭</Button>,
        ]}
        width={550}
      >
        {selectedBet && (
          <Descriptions bordered column={1} size="small" labelStyle={{ width: 110, background: '#161b22' }}>
            <Descriptions.Item label="局号">{selectedBet.game_number}</Descriptions.Item>
            <Descriptions.Item label="下注时间">
              {selectedBet.bet_time ? dayjs(selectedBet.bet_time).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="下注方向">
              <Tag color={selectedBet.bet_direction === '庄' ? '#ff4d4f' : '#1890ff'}>
                {selectedBet.bet_direction}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="下注金额">¥{selectedBet.bet_amount.toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="下注档位">
              <Tag color={selectedBet.bet_tier === '保守' ? 'orange' : selectedBet.bet_tier === '进取' ? 'red' : 'blue'}>
                {selectedBet.bet_tier}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={BET_STATUS_COLORS[selectedBet.status]}>{selectedBet.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="开奖结果">
              {selectedBet.game_result
                ? <Tag color={selectedBet.game_result === '庄' ? '#ff4d4f' : '#1890ff'}>{selectedBet.game_result}</Tag>
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="盈亏">
              <span style={{
                color: selectedBet.profit_loss && selectedBet.profit_loss > 0 ? '#ff4d4f'
                  : selectedBet.profit_loss && selectedBet.profit_loss < 0 ? '#52c41a'
                  : undefined,
                fontWeight: 700,
                fontSize: 15,
              }}>
                {selectedBet.profit_loss !== null
                  ? `${selectedBet.profit_loss > 0 ? '+' : ''}${selectedBet.profit_loss?.toFixed(0)}`
                  : '-'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="余额变化">
              ¥{selectedBet.balance_before?.toLocaleString()} → ¥{selectedBet.balance_after?.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="自适应说明">{selectedBet.adapt_summary || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 内联样式 */}
      <style>{`
        .row-pending { background-color: rgba(250, 173, 20, 0.08) !important; }
        .row-win { background-color: rgba(82, 196, 26, 0.06) !important; }
        .row-loss { background-color: rgba(255, 77, 79, 0.06) !important; }
        .ant-descriptions-item-label { font-weight: 500 !important; }
      `}</style>
    </div>
  );
};

export default BetRecordsPage;
