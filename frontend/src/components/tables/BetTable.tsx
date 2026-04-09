/**
 * 下注记录表格组件
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
    { title: '局号', dataIndex: 'game_number', width: 55 },
    {
      title: '方向',
      dataIndex: 'bet_direction',
      width: 55,
      render: (v: string) => (
        <Tag color={v === '庄' ? '#ff4d4f' : '#1890ff'}>{v}</Tag>
      ),
    },
    { title: '金额', dataIndex: 'bet_amount', width: 65 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 75,
      render: (v: string) => <Tag color={BET_STATUS_COLORS[v]}>{v}</Tag>,
    },
    {
      title: '盈亏',
      dataIndex: 'profit_loss',
      width: 75,
      render: (v: number | null) =>
        v !== null ? (
          <span
            style={{
              color: v > 0 ? '#ff4d4f' : v < 0 ? '#52c41a' : undefined,
              fontWeight: 600,
            }}
          >
            {v > 0 ? '+' : ''}
            {v?.toFixed(0)}
          </span>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <Table
      dataSource={data}
      columns={columns}
      rowKey={(r, i) => `${r.game_number}-${i}`}
      size="small"
      loading={loading}
      pagination={{
        current: page,
        pageSize: 5,
        total: total || data.length,
        onChange: onPageChange,
        size: 'small',
      }}
      scroll={{ y: 160 }}
      locale={{ emptyText: '暂无记录' }}
    />
  );
};

export default BetTable;
