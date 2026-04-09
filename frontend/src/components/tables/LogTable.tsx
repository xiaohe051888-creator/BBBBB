/**
 * 实盘日志表格组件
 */
import React from 'react';
import { Table, Space } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { PRIORITY_COLORS } from '../../utils/constants';

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

interface LogTableProps {
  data: LogEntry[];
  loading?: boolean;
  scrollY?: number;
}

const LogTable: React.FC<LogTableProps> = ({
  data,
  loading = false,
  scrollY = 200,
}) => {
  const columns: ColumnsType<LogEntry> = [
    {
      title: '时间',
      dataIndex: 'log_time',
      width: 65,
      render: (v: string) => (v ? dayjs(v).format('HH:mm:ss') : ''),
    },
    {
      title: '局',
      dataIndex: 'game_number',
      width: 40,
      render: (v: number | null) => v ?? '-',
    },
    {
      title: '事件',
      dataIndex: 'event_type',
      width: 90,
      render: (v: string, record: LogEntry) => (
        <Space size={4}>
          {record.is_pinned && (
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
          )}
          <span
            style={{
              color: PRIORITY_COLORS[record.priority] || '#1890ff',
              fontSize: 12,
            }}
          >
            {v}
          </span>
        </Space>
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      ellipsis: true,
      render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span>,
    },
  ];

  return (
    <Table
      dataSource={data}
      columns={columns}
      rowKey="id"
      size="small"
      loading={loading}
      pagination={false}
      scroll={{ y: scrollY }}
      locale={{ emptyText: '暂无日志' }}
      rowClassName={(record) => (record.is_pinned ? 'log-pinned-row' : '')}
    />
  );
};

export default LogTable;
