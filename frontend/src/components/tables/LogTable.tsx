/**
 * 实盘日志表格组件 - 自适应布局，无横向滚动
 */
import React from 'react';
import { Table, Space, Modal, Button } from 'antd';
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

// PriorityIcon组件暂时未使用，保留供将来使用
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _PriorityIcon: React.FC<{ priority: string }> = ({ priority }) => {
  const color = PRIORITY_COLORS[priority] || '#1890ff';
  if (priority === 'high') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
        <path d="M12 2L2 22h20L12 2zm0 4l7 14H5l7-14z" fill={color}/>
        <path d="M11 10v6h2v-6h-2z" fill="#000"/>
      </svg>
    );
  }
  if (priority === 'medium') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
        <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none"/>
        <circle cx="12" cy="12" r="4" fill={color}/>
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none"/>
      <path d="M12 7v6" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
};

const LogTable: React.FC<LogTableProps> = ({
  data,
  loading = false,
  scrollY = 240,
}) => {
  const columns: ColumnsType<LogEntry> = [
    {
      title: '时间',
      dataIndex: 'log_time',
      width: '18%',
      align: 'center',
      render: (v: string) => (
        <span style={{ fontSize: 11, color: '#8b949e', fontFamily: 'monospace' }}>
          {v ? dayjs(v).format('HH:mm:ss') : '-'}
        </span>
      ),
    },
    {
      title: '局',
      dataIndex: 'game_number',
      width: '12%',
      align: 'center',
      render: (v: number | null) => (
        <span style={{ fontSize: 12, fontWeight: 500 }}>{v ?? '-'}</span>
      ),
    },
    {
      title: '事件',
      dataIndex: 'event_type',
      width: '25%',
      align: 'center',
      render: (v: string, record: LogEntry) => (
        <Space size={4} style={{ justifyContent: 'center' }}>
          {record.is_pinned && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff4d4f">
              <path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z"/>
            </svg>
          )}
          <span
            style={{
              color: PRIORITY_COLORS[record.priority] || '#1890ff',
              fontSize: 12,
              fontWeight: 500,
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
      width: '45%',
      render: (v: string, record: LogEntry) => {
        if (!v) return <span style={{ fontSize: 12, color: '#c9d1d9' }}>-</span>;
        
        const isLong = v.length > 25;
        const displayStr = isLong ? v.substring(0, 25) + '...' : v;
        
        return (
          <Space size={4} wrap>
            <span style={{ fontSize: 12, color: '#c9d1d9', lineHeight: 1.4 }}>{displayStr}</span>
            {isLong && (
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: 12 }}
                onClick={() => {
                  Modal.info({
                    title: `日志详情 - ${record.event_type}`,
                    width: 600,
                    maskClosable: true,
                    content: (
                      <div style={{ maxHeight: '60vh', overflowY: 'auto', marginTop: 16 }}>
                        <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontSize: 13, color: '#c9d1d9', backgroundColor: '#161b22', padding: 12, borderRadius: 6 }}>
                          {v}
                        </pre>
                      </div>
                    ),
                  });
                }}
              >
                详情
              </Button>
            )}
          </Space>
        );
      },
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
      rowKey={(record) => record.id || Math.random().toString(36).substr(2, 9)}
      size="small"
      loading={loading}
      pagination={{
        pageSize: 100, // 启用分页，限制单页最大 DOM 渲染数量，防止浏览器假死
        showSizeChanger: true,
        pageSizeOptions: ['50', '100', '500'],
      }}
      scroll={{ x: 'max-content', y: scrollY }}
      locale={{ emptyText: '暂无日志记录' }}
      rowClassName={(record) => (record.is_pinned ? 'log-pinned-row' : '')}
      style={{ width: '100%' }}
    />
  );
};

export default LogTable;
