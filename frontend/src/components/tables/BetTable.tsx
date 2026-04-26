/**
 * 下注记录表格组件 - 自适应布局，无横向滚动
 */
import React from 'react';
import { Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BET_STATUS_COLORS } from '../../utils/constants';

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

interface BetTableProps {
  data: BetRecord[];
  loading?: boolean;
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}

const BetTable: React.FC<BetTableProps> = ({
  data,
  loading = false,
  page,
  total,
  onPageChange,
}) => {
  const columns: ColumnsType<BetRecord> = [
    { 
      title: '局号', 
      dataIndex: 'game_number', 
      width: '15%',
      align: 'center',
    },
    {
      title: '方向',
      dataIndex: 'bet_direction',
      width: '20%',
      align: 'center',
      render: (v: string) => (
        <Tag color={v === '庄' ? '#ff4d4f' : '#1890ff'} style={{ fontSize: 12, fontWeight: 600 }}>{v}</Tag>
      ),
    },
    { 
      title: '金额', 
      dataIndex: 'bet_amount', 
      width: '20%',
      align: 'center',
      render: (v: number) => <span style={{ fontWeight: 500 }}>{v}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: '20%',
      align: 'center',
      render: (v: string) => <Tag color={BET_STATUS_COLORS[v]} style={{ fontSize: 11 }}>{v}</Tag>,
    },
    {
      title: '盈亏',
      dataIndex: 'profit_loss',
      width: '25%',
      align: 'center',
      render: (v: number | null) =>
        v !== null ? (
          <span
            style={{
              color: v > 0 ? '#ff4d4f' : v < 0 ? '#52c41a' : '#888',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {v > 0 ? '+' : ''}{v?.toFixed(0)}
          </span>
        ) : (
          <span style={{ color: '#555' }}>-</span>
        ),
    },
  ];

  return (
    <Table
      className="mobile-card-table"
      dataSource={data}
      columns={columns.map(col => ({
        ...col,
        onCell: () => ({
          'data-label': typeof col.title === 'string' ? col.title : ''
        } as React.HTMLAttributes<HTMLElement>)
      }))}
      rowKey={(r) => `bet-${r.game_number}-${r.bet_time || r.balance_before}`}
      size="small"
      loading={loading}
      pagination={{
        current: page,
        pageSize: 5,
        total: total || data.length,
        onChange: onPageChange,
        size: 'small',
        showTotal: (t) => `共 ${t} 条`,
      }}
      scroll={{ x: 'max-content', y: 200 }}
      locale={{ emptyText: '暂无下注记录' }}
      style={{ width: '100%' }}
    />
  );
};

export default BetTable;
