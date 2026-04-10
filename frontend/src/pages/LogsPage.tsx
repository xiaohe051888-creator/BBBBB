/**
 * 实盘日志详情页 - 完整系统日志、事件追踪、错误告警
 * 路由：/dashboard/:tableId/logs
 * 
 * 优化：使用React Query + 乐观UI策略，页面切换无加载转圈
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Table, Tag, Space, Select,
  Input, Tooltip, Modal, Empty, Badge, Timeline, Alert, Switch, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useLogsQuery, type LogEntry, useAddLogOptimistically } from '../hooks';
import { useSystemDiagnostics } from '../hooks/useSystemDiagnostics';
import { SystemStatusPanel } from '../components/ui/SystemStatusPanel';
import { PRIORITY_COLORS, LOG_CATEGORIES } from '../utils/constants';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';

// 精致SVG图标组件
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
  Pin: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z"/>
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
    </svg>
  ),
  Warning: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>
  ),
  FileText: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </svg>
  ),
  CheckCircle: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  ),
  Download: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </svg>
  ),
  Chart: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
    </svg>
  ),
  Success: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  Error: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  ),
};

const LogsPage: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addLogOptimistically = useAddLogOptimistically();

  // 系统实时诊断
  const { diagnostics, dismissIssue, retryConnection } = useSystemDiagnostics({ tableId });

  // 分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // 筛选
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // React Query获取数据（乐观UI：永远不显示loading，数据来了直接渲染）
  const { data: logsData } = useLogsQuery({ 
    tableId, 
    category: filterCategory || undefined,
    page, 
    pageSize 
  });

  const logs = logsData?.logs || [];

  // 自动滚动
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 详情弹窗
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // WebSocket实时推送
  const wsRef = useRef<WebSocket | null>(null);

  // 手动刷新
  const handleRefresh = () => {
    if (!tableId) return;
    queryClient.invalidateQueries({ queryKey: ['logs', tableId] });
  };

  // WebSocket实时推送
  useEffect(() => {
    if (!tableId) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const connectWS = () => {
      if (isUnmounted) return;
      try {
        const ws = api.createWebSocket(tableId);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'log') {
              // 乐观更新：立即将新日志添加到缓存
              addLogOptimistically(tableId, data.data);
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
  }, [tableId, addLogOptimistically]);

  // 筛选后的数据（客户端筛选）
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      if (filterCategory && l.category !== filterCategory) return false;
      if (filterPriority && l.priority !== filterPriority) return false;
      if (debouncedSearchText && !(
        l.description.toLowerCase().includes(debouncedSearchText.toLowerCase()) ||
        l.event_type.includes(debouncedSearchText) ||
        String(l.game_number).includes(debouncedSearchText)
      )) return false;
      return true;
    });
  }, [logs, filterCategory, filterPriority, debouncedSearchText]);

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

  // ====== 导出功能 ======
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
    downloadFile(csv, `logs_${tableId}_${dayjs().format('YYYYMMDD_HHmmss')}.csv`, 'text/csv;charset=utf-8;');
    message.success(`已导出 ${filteredLogs.length} 条日志（CSV）`);
  };

  const exportToJSON = () => {
    if (!filteredLogs.length) { message.warning('暂无数据可导出'); return; }
    const json = JSON.stringify(filteredLogs, null, 2);
    downloadFile(json, `logs_${tableId}_${dayjs().format('YYYYMMDD_HHmmss')}.json`, 'application/json');
    message.success(`已导出 ${filteredLogs.length} 条日志（JSON）`);
  };

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

  // 表格列定义 - 自适应布局，避免横向滚动
  const columns: ColumnsType<LogEntry> = [
    {
      title: '时间',
      dataIndex: 'log_time',
      width: '12%',
      render: (v: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
          {v ? dayjs(v).format('HH:mm:ss') : ''}
        </span>
      ),
      sorter: (a, b) => dayjs(a.log_time).valueOf() - dayjs(b.log_time).valueOf(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '局号',
      dataIndex: 'game_number',
      width: '8%',
      render: (v: number | null) => v ?? '-',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: '10%',
      render: (v: string) => (
        <Tag color={PRIORITY_COLORS[v]} style={{ fontSize: 10, fontWeight: 600, padding: '0 4px' }}>
          {v}
        </Tag>
      ),
      filters: [
        { text: 'P0 致命', value: 'P0' },
        { text: 'P1 严重', value: 'P1' },
        { text: 'P2 警告', value: 'P2' },
        { text: 'P3 信息', value: 'P3' },
      ],
      onFilter: (value, record) => record.priority === value,
    },
    {
      title: '类别',
      dataIndex: 'category',
      width: '10%',
      render: (v: string) => (
        <Tag style={{ fontSize: 10, padding: '0 4px' }}>{v.slice(0, 4)}</Tag>
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
      render: (v: string) => (
        <Tooltip title={v}>
          <span style={{ cursor: 'pointer', fontSize: 11 }}>{v}</span>
        </Tooltip>
      ),
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

  // 时间线视图数据（最近20条）
  const recentLogs = filteredLogs.slice(0, 20);

  return (
    <div className="page-wrapper">
      {/* 顶部导航 */}
      <div className="page-nav-bar">
        <div className="page-nav-left">
          <Button icon={<Icons.Back />} onClick={() => navigate(`/dashboard/${tableId}`)}>
            返回
          </Button>
          <span className="page-nav-title">
            <Icons.FileText />
            <span style={{ marginLeft: 8 }}>实盘日志 — {tableId}</span>
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
          <Button icon={<Icons.Download />} size="small" onClick={exportToCSV} title="导出CSV">
            导出CSV
          </Button>
          <Button icon={<Icons.Download />} size="small" onClick={exportToJSON} title="导出JSON">
            导出JSON
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* 左侧：主日志表格 */}
        <div className="logs-layout-col-left" style={{ flex: '1 1 500px', minWidth: 0 }}>
          {/* 筛选栏 */}
          <Card size="small" style={{ marginBottom: 12 }}>
            <Space size="middle" wrap>
              <Icons.Filter /> <strong style={{ color: '#8b949e' }}>筛选：</strong>

              <Select
                placeholder="事件类别"
                allowClear
                value={filterCategory || undefined}
                onChange={(v) => { setFilterCategory(v || ''); setPage(1); }}
                style={{ width: 110 }}
                size="small"
                options={LOG_CATEGORIES}
              />

              <Select
                placeholder="优先级"
                allowClear
                value={filterPriority || undefined}
                onChange={(v) => { setFilterPriority(v || ''); setPage(1); }}
                style={{ width: 95 }}
                size="small"
                options={[
                  { label: 'P0 致命', value: 'P0' },
                  { label: 'P1 严重', value: 'P1' },
                  { label: 'P2 警告', value: 'P2' },
                  { label: 'P3 信息', value: 'P3' },
                ]}
              />

              <Input
                placeholder="搜索内容..."
                size="small"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                prefix={<Icons.Search />}
                style={{ width: 160 }}
              />

              <Button
                size="small"
                onClick={() => {
                  setFilterCategory('');
                  setFilterPriority('');
                  setSearchText('');
                }}
              >
                重置
              </Button>
            </Space>
          </Card>

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
              locale={{ emptyText: <Empty description="暂无日志记录" /> }}
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

          {/* 告警面板 */}
          {(stats.errors > 0) && (
            <Alert
              message={`当前有 ${stats.errors} 个未处理的严重问题`}
              type="error"
              showIcon
              icon={<Icons.Warning />}
              style={{ marginBottom: 12 }}
            />
          )}

          {/* 实时时间线 */}
          <Card
            title={<span><Icons.Clock /> 最近事件</span>}
            size="small"
            style={{ marginBottom: 12 }}
            styles={{ body: { maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' } }}
          >
            <Timeline
              items={recentLogs.map(log => ({
                color: log.priority === 'P0' ? 'red' : log.priority === 'P1' ? 'orange' : log.event_result === '成功' ? 'green' : 'blue',
                children: (
                  <div key={log.id} style={{ paddingBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: '#8b949e',
                      }}>
                        {log.log_time ? dayjs(log.log_time).format('HH:mm:ss') : ''}
                      </span>
                      {log.is_pinned && <span style={{ color: '#ff4d4f' }}><Icons.Pin /></span>}
                      <Tag color={PRIORITY_COLORS[log.priority]} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                        {log.priority}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{log.event_type}</div>
                    <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
                      {log.description.slice(0, 40)}{log.description.length > 40 ? '...' : ''}
                    </div>
                  </div>
                ),
              }))}
            />
          </Card>

          {/* 类别分布 */}
          <Card title={<span><Icons.Chart /> 分类统计</span>} size="small">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(stats.byCategory).map(([cat, count]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Tag style={{ margin: 0 }}>{cat}</Tag>
                  <span style={{ fontWeight: 600, color: '#58a6ff' }}>{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* 详情弹窗 */}
      <Modal
        title={`日志详情 - ${selectedLog?.event_code}`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>关闭</Button>,
        ]}
        width={550}
      >
        {selectedLog && (
          <div style={{ lineHeight: 2 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              <span style={{ color: '#8b949e', flex: '0 0 80px' }}>事件编码：</span>
              <code>{selectedLog.event_code}</code>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              <span style={{ color: '#8b949e', flex: '0 0 80px' }}>发生时间：</span>
              <span>{selectedLog.log_time ? dayjs(selectedLog.log_time).format('YYYY-MM-DD HH:mm:ss.SSS') : '-'}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              <span style={{ color: '#8b949e', flex: '0 0 80px' }}>关联局号：</span>
              <span>{selectedLog.game_number ?? '全局事件'}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              <span style={{ color: '#8b949e', flex: '0 0 80px' }}>事件类型：</span>
              <strong>{selectedLog.event_type}</strong>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: '#8b949e', flex: '0 0 80px' }}>执行结果：</span>
              {selectedLog.event_result === '成功'
                ? <Tag color="success"><Icons.CheckCircle /> 成功</Tag>
                : selectedLog.event_result === '失败'
                  ? <Tag color="error"><Icons.Warning /> 失败</Tag>
                  : '-'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              <span style={{ color: '#8b949e', flex: '0 0 80px' }}>事件类别：</span>
              <Tag>{selectedLog.category}</Tag>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: '#8b949e', flex: '0 0 80px' }}>优先级：</span>
              <div>
                <Tag color={PRIORITY_COLORS[selectedLog.priority]} style={{ fontWeight: 600 }}>
                  {selectedLog.priority}
                </Tag>
                {selectedLog.is_pinned && <Tag color="#ff4d4f"><Icons.Pin /> 已置顶</Tag>}
              </div>
            </div>
            <div>
              <span style={{ color: '#8b949e' }}>详细描述：</span>
              <div style={{
                background: '#161b22',
                padding: 12,
                borderRadius: 6,
                fontSize: 13,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                marginTop: 4,
              }}>
                {selectedLog.description}
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};

export default LogsPage;
