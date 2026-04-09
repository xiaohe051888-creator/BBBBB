/**
 * 开奖记录表格组件
 */
import React from 'react';
import { Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';

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

interface GameTableProps {
  data: GameRecord[];
  loading?: boolean;
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}

const GameTable: React.FC<GameTableProps> = ({
  data,
  loading = false,
  page,
  total,
  onPageChange,
}) => {
  const columns: ColumnsType<GameRecord> = [
    { title: '局号', dataIndex: 'game_number', width: 60 },
    {
      title: '结果',
      dataIndex: 'result',
      width: 70,
      render: (v: string) => (
        <Tag
          color={v === '庄' ? '#ff4d4f' : v === '闲' ? '#1890ff' : '#52c41a'}
          style={{ fontWeight: 700 }}
        >
          {v}
        </Tag>
      ),
    },
    { title: '预测', dataIndex: 'predict_direction', width: 60 },
    {
      title: '正确',
      dataIndex: 'predict_correct',
      width: 55,
      render: (v: boolean | null) =>
        v === null ? (
          '-'
        ) : v ? (
          <Tag color="success">✓</Tag>
        ) : (
          <Tag color="error">✗</Tag>
        ),
    },
    {
      title: '盈亏',
      dataIndex: 'profit_loss',
      width: 75,
      render: (v: number) => (
        <span
          style={{
            color: v > 0 ? '#ff4d4f' : v < 0 ? '#52c41a' : undefined,
            fontWeight: 600,
          }}
        >
          {v > 0 ? '+' : ''}
          {v?.toFixed(0)}
        </span>
      ),
    },
  ];

  return (
    <Table
      dataSource={data}
      columns={columns}
      rowKey="game_number"
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

export default GameTable;
