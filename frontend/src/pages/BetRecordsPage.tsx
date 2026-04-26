/**
 * 下注记录详情页 - 完整下注历史、统计图表、盈亏分析
 * 路由：/dashboard/bets
 * 
 * 优化：使用React Query + 乐观UI策略，自适应布局，精致图标
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Table, Tag, Space, Statistic,
  Select, Input, Modal, Empty,
  Progress, Badge, Descriptions,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useBetsQuery, type BetRecord } from '../hooks';
import { BET_STATUS_COLORS } from '../utils/constants';
import { useQueryClient } from '@tanstack/react-query';

// 精致图标组件
const Icons = {
  Back: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
  ),
  Refresh: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </svg>
  ),
  Filter: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
    </svg>
  ),
  Dollar: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
    </svg>
  ),
  Rise: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
    </svg>
  ),
  Fall: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z"/>
    </svg>
  ),
};

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
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // React Query获取数据（乐观UI：永远不显示loading，数据来了直接渲染）
  const { data: betsData } = useBetsQuery({});

  // 使用useMemo缓存数据，避免useMemo依赖变化
  const bets = useMemo(() => betsData?.bets || [], [betsData]);
  const total = useMemo(() => betsData?.total || 0, [betsData]);

  // 筛选
  const [filterDirection, setFilterDirection] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterTier, setFilterTier] = useState<string>('');
  const [searchGameNumber, setSearchGameNumber] = useState('');

  // 详情弹窗
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<BetRecord | null>(null);

  // 手动刷新
  const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['bets'] });
  };

  // 计算汇总数据（使用useMemo优化性能）
  const summary: BetSummary | null = useMemo(() => {
    if (!bets.length) return null;

    let totalAmount = 0;
    let totalPnL = 0;
    let winCount = 0;
    let lossCount = 0;
    let pendingCount = 0;
    let maxWin = -Infinity;
    let maxLoss = Infinity;

    bets.forEach(b => {
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
    for (let i = bets.length - 1; i >= 0; i--) {
      const pl = bets[i].profit_loss;
      if (pl === null || pl === undefined) break;
      if (currentStreak === 0) {
        currentStreak = pl > 0 ? 1 : pl < 0 ? -1 : 0;
      } else if ((currentStreak > 0 && pl > 0) || (currentStreak < 0 && pl < 0)) {
        currentStreak += currentStreak > 0 ? 1 : -1;
      } else break;
    }

    return {
      totalBets: total,
      totalAmount,
      totalPnL,
      winCount,
      lossCount,
      pendingCount,
      winRate: (winCount + lossCount) > 0 ? winCount / (winCount + lossCount) * 100 : 0,
      avgBet: bets.length > 0 ? totalAmount / bets.length : 0,
      maxWin: maxWin === -Infinity ? 0 : maxWin,
      maxLoss: maxLoss === Infinity ? 0 : maxLoss,
      currentStreak,
    };
  }, [bets, total]);

  // 筛选后的数据（客户端筛选）
  const filteredBets = useMemo(() => {
    return bets.filter(b => {
      if (filterDirection && b.bet_direction !== filterDirection) return false;
      if (filterStatus && b.status !== filterStatus) return false;
      if (filterTier && b.bet_tier !== filterTier) return false;
      if (searchGameNumber && !String(b.game_number).includes(searchGameNumber)) return false;
      return true;
    });
  }, [bets, filterDirection, filterStatus, filterTier, searchGameNumber]);

  // 表格列定义 - 自适应宽度
  const columns: ColumnsType<BetRecord> = [
    {
      title: '局号',
      dataIndex: 'game_number',
      width: '10%',
      align: 'center',
      sorter: (a, b) => a.game_number - b.game_number,
    },
    {
      title: '下注方向',
      dataIndex: 'bet_direction',
      width: '15%',
      align: 'center',
      render: (v: string) => (
        <Tag color={v === '庄' ? '#ff4d4f' : '#1890ff'} style={{ fontWeight: 600, fontSize: 11 }}>
          {v}
        </Tag>
      ),
    },
    {
      title: '金额',
      dataIndex: 'bet_amount',
      width: '12%',
      align: 'center',
      sorter: (a, b) => a.bet_amount - b.bet_amount,
      render: (v: number) => <span style={{ fontWeight: 500, fontSize: 12 }}>¥{v}</span>,
    },
    {
      title: '档位',
      dataIndex: 'bet_tier',
      width: '12%',
      align: 'center',
      render: (v: string) => (
        <Tag color={v === '保守' ? 'orange' : v === '进取' ? 'red' : 'blue'} style={{ fontSize: 10 }}>
          {v}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: '12%',
      align: 'center',
      render: (v: string) => (
        <Tag color={BET_STATUS_COLORS[v]} style={{ fontSize: 10 }}>{v}</Tag>
      ),
    },
    {
      title: '开奖结果',
      dataIndex: 'game_result',
      width: '12%',
      align: 'center',
      render: (v: string | null) => v
        ? <Tag color={v === '庄' ? '#ff4d4f' : '#1890ff'} style={{ fontSize: 11 }}>{v}</Tag>
        : '-',
    },
    {
      title: '盈亏',
      dataIndex: 'profit_loss',
      width: '14%',
      align: 'center',
      sorter: (a, b) => (a.profit_loss || 0) - (b.profit_loss || 0),
      render: (v: number | null) =>
        v !== null && v !== undefined ? (
          <span style={{
            color: v > 0 ? '#ff4d4f' : v < 0 ? '#52c41a' : '#888',
            fontWeight: 700,
            fontSize: 12,
          }}>
            {v > 0 ? '+' : ''}{v.toFixed(0)}
          </span>
        ) : <span style={{ color: '#888' }}>-</span>,
    },
    {
      title: '操作',
      width: '13%',
      align: 'center',
      render: (_: unknown, r: BetRecord) => (
        <Button
          type="link"
          size="small"
          onClick={() => { setSelectedBet(r); setDetailModalOpen(true); }}
          style={{ fontSize: 12, padding: '0 4px' }}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className="page-wrapper" style={{ padding: '16px' }}>
      {/* 顶部导航 */}
      <div className="page-nav-bar" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div className="page-nav-left" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button icon={<Icons.Back />} onClick={() => navigate("/dashboard")} size="small">
            返回
          </Button>
          <span className="page-nav-title" style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Dollar />
            下注记录 — {}
          </span>
          <Badge count={filteredBets.length} showZero style={{ backgroundColor: '#58a6ff' }} />
        </div>
        <div className="page-nav-right">
          <Button 
            icon={<Icons.Refresh />} 
            size="small" 
            onClick={handleRefresh}
          >
            刷新
          </Button>
        </div>
      </div>

      {/* 统计卡片 — 响应式网格 */}
      {summary && (
        <div className="stats-grid" style={{ 
          marginBottom: 16, 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
          gap: 10 
        }}>
          <Card size="small">
            <Statistic title="总下注" value={summary.totalBets} suffix="笔" styles={{ content: { fontSize: 16, color: '#58a6ff' } }} />
          </Card>
          <Card size="small">
            <Statistic title="总投注" value={summary.totalAmount} prefix="¥" styles={{ content: { fontSize: 16 } }} />
          </Card>
          <Card size="small">
            <Statistic
              title="总盈亏"
              value={summary.totalPnL}
              prefix={summary.totalPnL >= 0 ? <Icons.Rise /> : <Icons.Fall />}
              styles={{ content: { fontSize: 16, color: summary.totalPnL >= 0 ? '#ff4d4f' : '#52c41a' } }}
            />
          </Card>
          <Card size="small">
            <Statistic title="胜率" value={summary.winRate.toFixed(1)} suffix="%" styles={{ content: { fontSize: 16, color: summary.winRate >= 50 ? '#ff4d4f' : '#52c41a' } }} />
          </Card>
          <Card size="small">
            <Statistic title="胜/负/待" value={`${summary.winCount}/${summary.lossCount}/${summary.pendingCount}`} styles={{ content: { fontSize: 13 } }} />
          </Card>
          <Card size="small">
            <Statistic title="均注" value={Math.round(summary.avgBet)} prefix="¥" styles={{ content: { fontSize: 14 } }} />
          </Card>
          <Card size="small">
            <Statistic title="最大单赢" value={summary.maxWin} prefix="+" styles={{ content: { fontSize: 14, color: '#ff4d4f' } }} />
          </Card>
          <Card size="small">
            <Statistic
              title="连胜/连败"
              value={Math.abs(summary.currentStreak)}
              suffix={summary.currentStreak > 0 ? '胜' : summary.currentStreak < 0 ? '败' : '-'}
              styles={{ content: {
                fontSize: 13,
                color: summary.currentStreak > 2 ? '#ff4d4f' : summary.currentStreak < -2 ? '#52c41a' : undefined,
              } }}
            />
          </Card>
        </div>
      )}

      {/* 盈亏进度条 */}
      {summary && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#8b949e', whiteSpace: 'nowrap' }}>盈亏分布</span>
            <div style={{ flex: '1 1 200px', minWidth: 150 }}>
              <Progress
                percent={
                  summary.winCount + summary.lossCount > 0
                    ? (summary.winCount / (summary.winCount + summary.lossCount)) * 100
                    : 0
                }
                success={{ percent: 0 }}
                strokeColor="#ff4d4f"
                railColor="#52c41a"
                format={() => `${summary.winCount}胜 / ${summary.lossCount}负`}
              />
            </div>
            <Space size={4}>
              <Tag color="#ff4d4f" style={{ fontSize: 11 }}>胜 {summary.winCount}</Tag>
              <Tag color="#52c41a" style={{ fontSize: 11 }}>负 {summary.lossCount}</Tag>
              <Tag color="#faad14" style={{ fontSize: 11 }}>待 {summary.pendingCount}</Tag>
            </Space>
          </div>
        </Card>
      )}

      {/* 筛选栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space size="middle" wrap style={{ width: '100%' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8b949e' }}>
            <Icons.Filter /> <strong>筛选：</strong>
          </span>

          <Select
            placeholder="下注方向"
            allowClear
            value={filterDirection || undefined}
            onChange={setFilterDirection}
            style={{ width: 100 }}
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
            style={{ width: 90 }}
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
            prefix={<Icons.Search />}
            style={{ width: 110 }}
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

          <span style={{ marginLeft: 'auto', color: '#8b949e', fontSize: 12 }}>
            共 {filteredBets.length} 条记录
          </span>
        </Space>
      </Card>

      {/* 数据表格 - 自适应布局 */}
      <Card size="small">
        <Table
          className="mobile-card-table"
          dataSource={filteredBets}
          columns={columns.map(col => ({
            ...col,
            onCell: () => ({
              'data-label': typeof col.title === 'string' ? col.title : ''
            } as React.HTMLAttributes<HTMLElement>)
          }))}
          rowKey={(r, index) => `bet-${r.game_number}-${r.bet_direction}-${r.bet_amount}-${index}`}
          size="small"
          pagination={{
            current: page,
            pageSize,
            total: filteredBets.length,
            onChange: (p, ps) => { setPage(p); if (ps !== pageSize) setPageSize(ps); },
            showTotal: (t) => `共 ${t} 条`,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            size: 'small',
          }}
          scroll={{ x: 'max-content', y: 'calc(max(300px, 100vh - 520px))' }}
          locale={{ emptyText: <Empty description="暂无下注记录" /> }}
          rowClassName={(record) => {
            if (record.status === '待结算') return 'row-pending';
            if (record.profit_loss && record.profit_loss > 0) return 'row-win';
            if (record.profit_loss && record.profit_loss < 0) return 'row-loss';
            return '';
          }}
          style={{ width: '100%' }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title={`下注详情 - 第${selectedBet?.game_number}局`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>关闭</Button>,
        ]}
        width={520}
      >
        {selectedBet && (
          <Descriptions bordered column={1} size="small" labelStyle={{ width: 100, background: '#161b22' }}>
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
                fontSize: 14,
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
    </div>
  );
};

export default BetRecordsPage;
