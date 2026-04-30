/**
 * 实盘日志详情页 - 完整系统日志、事件追踪、错误告警
 * 路由：/dashboard/:tableId/logs
 * 
 * 优化：使用React Query + 乐观UI策略，页面切换无加载转圈
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Button, Card, Table, Tag, Space, Badge, Switch, App, Input, Select, Modal, List, Typography, Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useLogsQuery, type LogEntry, useAddLogOptimistically } from '../hooks';
import { useSystemDiagnostics } from '../hooks/useSystemDiagnostics';
import { SystemStatusPanel } from '../components/ui/SystemStatusPanel';
import { PRIORITY_COLORS } from '../utils/constants';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';

// Mock components since the real ones were deleted from the repository
const Icons = {
  Refresh: () => <span>↻</span>,
  Download: () => <span>↓</span>,
  Back: () => <span>←</span>,
  Pin: () => <span>📌</span>,
  Success: () => <span>✅</span>,
  Error: () => <span>❌</span>,
  FileText: () => <span>📄</span>,
};

const priorityLabel = (v: string): string =>
  v === 'P0' ? '致命' : v === 'P1' ? '严重' : v === 'P2' ? '警告' : v === 'P3' ? '信息' : '未知';


type LogFilterBarProps = {
  categories: string[];
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterPriority: string;
  setFilterPriority: (v: string) => void;
  filterTaskId: string;
  setFilterTaskId: (v: string) => void;
  onCopyTaskId: () => void;
  searchText: string;
  setSearchText: (v: string) => void;
  onReset: () => void;
};

const LogFilterBar: React.FC<LogFilterBarProps> = ({
  categories,
  filterCategory,
  setFilterCategory,
  filterPriority,
  setFilterPriority,
  filterTaskId,
  setFilterTaskId,
  onCopyTaskId,
  searchText,
  setSearchText,
  onReset,
}) => {
  const categoryOptions = useMemo(
    () => [{ label: '全部类别', value: '' }, ...categories.map(c => ({ label: c, value: c }))],
    [categories]
  );

  const priorityOptions = [
    { label: '全部优先级', value: '' },
    { label: '致命', value: 'P0' },
    { label: '严重', value: 'P1' },
    { label: '警告', value: 'P2' },
    { label: '信息', value: 'P3' },
  ];

  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space wrap>
        <Select
          value={filterCategory}
          onChange={setFilterCategory}
          options={categoryOptions}
          style={{ minWidth: 160 }}
          size="small"
        />
        <Select
          value={filterPriority}
          onChange={setFilterPriority}
          options={priorityOptions}
          style={{ minWidth: 140 }}
          size="small"
        />
        <Input
          value={filterTaskId}
          onChange={(e) => setFilterTaskId(e.target.value)}
          placeholder="任务编号筛选"
          allowClear
          size="small"
          style={{ width: 220 }}
        />
        <Button size="small" disabled={!filterTaskId} onClick={onCopyTaskId}>
          复制任务编号
        </Button>
        <Input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="搜索：说明/事件/局号"
          allowClear
          size="small"
          style={{ width: 220 }}
        />
        <Button size="small" onClick={onReset}>
          重置筛选
        </Button>
      </Space>
    </Card>
  );
};

type LogDetailModalProps = {
  open: boolean;
  log: LogEntry | null;
  onClose: () => void;
};

const LogDetailModal: React.FC<LogDetailModalProps> = ({ open, log, onClose }) => {
  const { message } = App.useApp();

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('已复制');
    } catch {
      message.error('复制失败');
    }
  };

  const detailText = log ? JSON.stringify(log, null, 2) : '';

  return (
    <Modal
      title="日志详情"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="copy" disabled={!log} onClick={() => copy(detailText)}>
          复制
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={720}
    >
      {log ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Space wrap>
            <Tag color={PRIORITY_COLORS[log.priority]}>{priorityLabel(log.priority)}</Tag>
            {log.category ? <Tag>{log.category}</Tag> : null}
            {log.event_result ? <Tag>{log.event_result}</Tag> : null}
            {log.is_pinned ? <Tag color="red">置顶</Tag> : null}
          </Space>
          <Divider style={{ margin: '8px 0' }} />
          <Typography.Text type="secondary">说明</Typography.Text>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {log.description || '-'}
          </Typography.Paragraph>
          <Divider style={{ margin: '8px 0' }} />
          <Typography.Text type="secondary">原始数据</Typography.Text>
          <pre style={{ margin: 0, maxHeight: 360, overflow: 'auto' }}>
            {detailText}
          </pre>
        </div>
      ) : (
        <Typography.Text type="secondary">未选择日志</Typography.Text>
      )}
    </Modal>
  );
};

type LogTimelineProps = {
  logs: LogEntry[];
};

const LogTimeline: React.FC<LogTimelineProps> = ({ logs }) => {
  const items = useMemo(() => logs.slice(0, 20), [logs]);

  return (
    <Card size="small" title="最新动态" style={{ marginBottom: 12 }}>
      <List
        size="small"
        dataSource={items}
        locale={{ emptyText: '暂无数据' }}
        renderItem={(l) => (
          <List.Item style={{ padding: '6px 0' }}>
            <Space size={8} style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space size={8}>
                <Tag color={PRIORITY_COLORS[l.priority]} style={{ marginInlineEnd: 0 }}>
                  {priorityLabel(l.priority)}
                </Tag>
                <span style={{ fontSize: 12 }}>{l.event_type || '-'}</span>
              </Space>
              <span style={{ fontSize: 11, opacity: 0.65, whiteSpace: 'nowrap' }}>
                {l.log_time ? dayjs(l.log_time).format('HH:mm:ss') : ''}
              </span>
            </Space>
          </List.Item>
        )}
      />
    </Card>
  );
};

type CategoryStatsProps = {
  stats: Record<string, number>;
};

const CategoryStats: React.FC<CategoryStatsProps> = ({ stats }) => {
  const items = useMemo(() => {
    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [stats]);

  return (
    <Card size="small" title="类别分布">
      <List
        size="small"
        dataSource={items}
        locale={{ emptyText: '暂无数据' }}
        renderItem={([k, v]) => (
          <List.Item style={{ padding: '6px 0' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12 }}>{k || '未分类'}</span>
              <Tag style={{ marginInlineEnd: 0 }}>{v}</Tag>
            </Space>
          </List.Item>
        )}
      />
    </Card>
  );
};

const LogsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const addLogOptimistically = useAddLogOptimistically();

  // 系统实时诊断
  const { diagnostics, dismissIssue, retryConnection } = useSystemDiagnostics({});

  // 分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // 筛选
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterTaskId, setFilterTaskId] = useState<string>(() => {
    const params = new URLSearchParams(location.search);
    return params.get('task_id') || '';
  });
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const taskId = params.get('task_id') || '';
    if (!taskId || taskId === filterTaskId) return;
    const t = setTimeout(() => setFilterTaskId(taskId), 0);
    return () => clearTimeout(t);
  }, [location.search, filterTaskId]);

  // React Query获取数据（乐观UI：永远不显示loading，数据来了直接渲染）
  const { data: logsData } = useLogsQuery({
    category: filterCategory || undefined,
    taskId: filterTaskId || undefined,
    page: 1,
    pageSize: 200 // 初始拉取200条以保证筛选和过滤时数据充足
  });

  // 使用useMemo缓存logs，避免useMemo依赖变化
  const logs = useMemo(() => logsData?.logs || [], [logsData]);

  // 自动滚动
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 详情弹窗
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // WebSocket实时推送
  const wsRef = useRef<WebSocket | null>(null);

  // 手动刷新
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['logs'] });
  }, [queryClient]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(handleRefresh, 15000);
    return () => clearInterval(timer);
  }, [autoRefresh, handleRefresh]);

  // WebSocket实时推送
  useEffect(() => {
    
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connectWS = () => {
      if (isUnmounted) return;
      try {
        const ws = api.createWebSocket();
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'log') {
              // 乐观更新：立即将新日志添加到缓存
              addLogOptimistically(data.data);
            }
          } catch {
            // WebSocket消息解析错误，忽略
          }
        };

        ws.onclose = () => {
          if (!isUnmounted) {
            reconnectTimer = setTimeout(connectWS, 3000);
          }
        };
      } catch {
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
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [addLogOptimistically]);

  // 筛选后的数据（客户端筛选）
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (filterCategory && l.category !== filterCategory) return false;
      if (filterPriority && l.priority !== filterPriority) return false;
      if (filterTaskId && l.task_id !== filterTaskId) return false;
      if (debouncedSearchText && !(
        l.description.toLowerCase().includes(debouncedSearchText.toLowerCase()) ||
        l.event_type.includes(debouncedSearchText) ||
        String(l.game_number).includes(debouncedSearchText)
      )) return false;
      return true;
    });
  }, [logs, filterCategory, filterPriority, filterTaskId, debouncedSearchText]);

  // 统计
  const stats = useMemo(() => {
    const result = {
      total: filteredLogs.length,
      pinned: filteredLogs.filter(l => l.is_pinned).length,
      errors: filteredLogs.filter(l => ['P0', 'P1'].includes(l.priority)).length,
      byCategory: {} as Record<string, number>,
    };
    filteredLogs.forEach(l => {
      result.byCategory[l.category] = (result.byCategory[l.category] || 0) + 1;
    });
    return result;
  }, [filteredLogs]);

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(logs.map(l => l.category).filter(Boolean))).sort() as string[];
  }, [logs]);

  // ====== 导出功能 ======
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: mimeType }); // BOM for Excel compatibility
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    if (!filteredLogs.length) { message.warning('暂无数据可导出'); return; }
    const headers = ['时间', '局号', '事件编码', '事件类型', '结果', '优先级', '类别', '说明'];
    const rows = filteredLogs.map(l => [
      l.log_time ? dayjs(l.log_time).format('YYYY-MM-DD HH:mm:ss') : '',
      l.game_number ?? '',
      l.event_code,
      l.event_type,
      l.event_result,
      l.priority,
      l.category,
      `"${(l.description || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadFile(csv, `日志_${dayjs().format('YYYYMMDD_HHmmss')}.csv`, 'text/csv;charset=utf-8;');
    message.success(`已导出 ${filteredLogs.length} 条日志（表格）`);
  };

  const exportToJSON = () => {
    if (!filteredLogs.length) { message.warning('暂无数据可导出'); return; }
    const json = JSON.stringify(filteredLogs, null, 2);
    downloadFile(json, `日志_${dayjs().format('YYYYMMDD_HHmmss')}.json`, 'application/json');
    message.success(`已导出 ${filteredLogs.length} 条日志（数据）`);
  };

  // 表格列定义 - 自适应布局，避免横向滚动
  const columns: ColumnsType<LogEntry> = [
    {
      title: '时间',
      dataIndex: 'log_time',
      width: '14%',
      render: (v: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap' }}>
          {v ? dayjs(v).format('HH:mm:ss') : ''}
        </span>
      ),
      sorter: (a, b) => dayjs(a.log_time).valueOf() - dayjs(b.log_time).valueOf(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '局号',
      dataIndex: 'game_number',
      width: '6%',
      render: (v: number | null) => v ?? '-',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: '10%',
      render: (v: string) => (
        <Tag color={PRIORITY_COLORS[v]} style={{ fontSize: 10, fontWeight: 600, padding: '0 4px' }}>
          {v === 'P0' ? '致命' : v === 'P1' ? '严重' : v === 'P2' ? '警告' : v === 'P3' ? '信息' : '未知'}
        </Tag>
      ),
      filters: [
        { text: '致命', value: 'P0' },
        { text: '严重', value: 'P1' },
        { text: '警告', value: 'P2' },
        { text: '信息', value: 'P3' },
      ],
      onFilter: (value, record) => record.priority === value,
    },
    {
      title: '类别',
      dataIndex: 'category',
      width: '10%',
      render: (v: string) => (
        <Tag style={{ fontSize: 10, padding: '0 4px' }}>{v ? v.slice(0, 4) : '-'}</Tag>
      ),
    },
    {
      title: '事件',
      dataIndex: 'event_type',
      width: '15%',
      render: (v: string, record: LogEntry) => (
        <Space size={2}>
          {record.is_pinned && (
            <span style={{ color: '#ff4d4f' }}><Icons.Pin /></span>
          )}
          <span style={{ fontWeight: 500, color: PRIORITY_COLORS[record.priority] || '#58a6ff', fontSize: 12 }}>
            {v}
          </span>
        </Space>
      ),
    },
    {
      title: '结果',
      dataIndex: 'event_result',
      width: '8%',
      render: (v: string) =>
        v === '成功'
          ? <Tag color="success" style={{ fontSize: 10, padding: '0 4px' }}><Icons.Success /></Tag>
          : v === '失败'
            ? <Tag color="error" style={{ fontSize: 10, padding: '0 4px' }}><Icons.Error /></Tag>
            : '-',
    },
    {
      title: '说明',
      dataIndex: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      width: '8%',
      render: (_: unknown, record: LogEntry) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, fontSize: 11 }}
          onClick={() => { setSelectedLog(record); setDetailModalOpen(true); }}
        >
          详情
        </Button>
      ),
    },
  ];

  // 重置筛选
  const handleResetFilters = () => {
    setFilterCategory('');
    setFilterPriority('');
    setFilterTaskId('');
    setSearchText('');
    setPage(1);
  };

  const handleCopyTaskId = async () => {
    if (!filterTaskId) return;
    try {
      await navigator.clipboard.writeText(filterTaskId);
      message.success('任务编号已复制');
    } catch {
      message.error('复制失败');
    }
  };

  useEffect(() => {
    if (!filterTaskId) return;
    queryClient.invalidateQueries({ queryKey: ['logs'] });
  }, [filterTaskId, queryClient]);

  return (
    <div className="page-wrapper">
      {/* 顶部导航 */}
      <div className="page-nav-bar">
        <div className="page-nav-left">
          <Button icon={<Icons.Back />} onClick={() => navigate("/dashboard")}>
            返回
          </Button>
          <span className="page-nav-title">
            <Icons.FileText />
            <span style={{ marginLeft: 8 }}>实盘日志 </span>
          </span>
          <Space size="small">
            <Badge count={stats.total} showZero style={{ backgroundColor: '#58a6ff' }} overflowCount={9999} />
            {stats.errors > 0 && (
              <Badge count={`${stats.errors}告警`} style={{ backgroundColor: '#ff4d4f' }} />
            )}
          </Space>
        </div>
        <div className="page-nav-right">
          {/* 系统实时状态 */}
          <SystemStatusPanel
            diagnostics={diagnostics}
            onDismissIssue={dismissIssue}
            onRetryConnection={retryConnection}
            compact
          />
          <Switch
            size="small"
            checked={autoRefresh}
            onChange={setAutoRefresh}
            checkedChildren="自动"
            unCheckedChildren="停止"
          />
          <Switch
            size="small"
            checked={autoScroll}
            onChange={setAutoScroll}
            checkedChildren="滚动"
            unCheckedChildren="固定"
          />
          <Button 
            icon={<Icons.Refresh />} 
            size="small" 
            onClick={handleRefresh}
          >
            刷新
          </Button>
          <Button icon={<Icons.Download />} size="small" onClick={exportToCSV} title="导出表格">
            导出表格
          </Button>
          <Button icon={<Icons.Download />} size="small" onClick={exportToJSON} title="导出数据">
            导出数据
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* 左侧：主日志表格 */}
        <div className="logs-layout-col-left" style={{ flex: '1 1 500px', minWidth: 0 }}>
          {/* 筛选栏 */}
          <LogFilterBar
            categories={categoryOptions}
            filterCategory={filterCategory}
            setFilterCategory={(v: string) => { setFilterCategory(v); setPage(1); }}
            filterPriority={filterPriority}
            setFilterPriority={(v: string) => { setFilterPriority(v); setPage(1); }}
            filterTaskId={filterTaskId}
            setFilterTaskId={(v: string) => { setFilterTaskId(v); setPage(1); }}
            onCopyTaskId={handleCopyTaskId}
            searchText={searchText}
            setSearchText={setSearchText}
            onReset={handleResetFilters}
          />

          {/* 日志表格 - 乐观UI：永远不显示loading，数据来了直接渲染 */}
          <Card size="small">
            <Table
              dataSource={filteredLogs}
              columns={columns}
              rowKey="id"
              size="small"
              pagination={{
                current: page,
                pageSize,
                total: filteredLogs.length,
                onChange: (p, ps) => { setPage(p); if (ps !== pageSize) setPageSize(ps); },
                showTotal: (total) => `共 ${total} 条日志`,
                showSizeChanger: true,
                showQuickJumper: true,
                pageSizeOptions: ['20', '50', '100', '200'],
                size: 'small',
              }}
              scroll={{ y: 'calc(100vh - 380px)' }}
              locale={{ emptyText: '暂无日志记录' }}
              rowClassName={(record) => {
                if (record.is_pinned) return 'log-pinned';
                if (record.priority === 'P0') return 'log-critical';
                if (record.priority === 'P1') return 'log-error';
                return '';
              }}
            />
          </Card>
        </div>

        {/* 右侧：系统状态 + 时间线 + 统计 */}
        <div className="logs-layout-col-right" style={{ flex: '1 1 300px' }}>
          {/* ===== 系统实时状态面板 ===== */}
          <SystemStatusPanel
            diagnostics={diagnostics}
            onDismissIssue={dismissIssue}
            onRetryConnection={retryConnection}
            compact={false}
          />
          <div style={{ marginBottom: 12 }} />

          {/* 实时时间线 */}
          <LogTimeline logs={filteredLogs} />

          {/* 类别分布 */}
          <CategoryStats stats={stats.byCategory} />
        </div>
      </div>

      {/* 详情弹窗 */}
      <LogDetailModal
        open={detailModalOpen}
        log={selectedLog}
        onClose={() => setDetailModalOpen(false)}
      />
    </div>
  );
};

export default LogsPage;
