/**
 * 开奖记录表格组件 - 自适应布局
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

// 精致图标
const Icons = {
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  Close: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  ),
};

const GameTable: React.FC<GameTableProps> = ({
  data,
  loading = false,
  page,
  total,
  onPageChange,
}) => {
  const columns: ColumnsType<GameRecord> = [
    { 
      title: '局号', 
      dataIndex: 'game_number', 
      width: '15%',
      align: 'center',
    },
    {
      title: '结果',
      dataIndex: 'result',
      width: '20%',
      align: 'center',
      render: (v: string) => (
        <Tag
          color={v === '庄' ? '#ff4d4f' : v === '闲' ? '#1890ff' : '#52c41a'}
          style={{ fontWeight: 700, fontSize: 12 }}
        >
          {v}
        </Tag>
      ),
    },
    { 
      title: '预测', 
      dataIndex: 'predict_direction', 
      width: '15%',
      align: 'center',
      render: (v: string | null) => v || '-',
    },
    {
      title: '正确',
      dataIndex: 'predict_correct',
      width: '15%',
      align: 'center',
      render: (v: boolean | null) =>
        v === null ? (
          '-'
        ) : v ? (
          <Tag color="success" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Icons.Check /> 正确
          </Tag>
        ) : (
          <Tag color="error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Icons.Close /> 错误
          </Tag>
        ),
    },
    {
      title: '盈亏',
      dataIndex: 'profit_loss',
      width: '35%',
      align: 'center',
      render: (v: number) => (
        <span
          style={{
            color: v > 0 ? '#ff4d4f' : v < 0 ? '#52c41a' : '#888',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {v > 0 ? '+' : ''}{v?.toFixed(0)}
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
        showTotal: (t) => `共 ${t} 条`,
      }}
      scroll={{ x: 'max-content', y: 200 }}
      locale={{ emptyText: '暂无开奖记录' }}
      style={{ width: '100%' }}
    />
  );
};

export default GameTable;
