/**
 * 实盘日志详情页 - 完整系统日志、事件追踪、错误告警
 * 路由：/dashboard/:tableId/logs
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Table, Tag, Space, Row, Col, Select,
  Input, Tooltip, Modal, Spin, Empty, Badge, Timeline, Alert, Switch, message,
} from 'antd';
import {
  ArrowLeftOutlined, ReloadOutlined, SearchOutlined,
  FilterOutlined, ExclamationCircleOutlined, ClockCircleOutlined,
  BellOutlined, BugOutlined, InfoCircleOutlined, CheckCircleOutlined,
  WarningOutlined, ThunderboltOutlined, FileTextOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import * as api from '../services/api';
import { PRIORITY_COLORS, LOG_CATEGORIES, STATUS_TEXTS } from '../utils/constants';

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

const LogsPage: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  // 数据
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // 分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // 筛选
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [searchText, setSearchText] = useState('');

  // 自动滚动
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 详情弹窗
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  // WebSocket实时推送
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

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

  // 加载日志
  const loadLogs = useCallback(async (p = page) => {
    if (!tableId) return;
    setLoading(true);
    try {
      const res = await api.getLogs({
        table_id: tableId,
        category: filterCategory || undefined,
        page: p,
        page_size: pageSize,
      });
      setLogs(res.data.data || []);
    } catch {
      // API请求失败时显示空数据（不使用模拟数据）
    } finally {
      setLoading(false);
    }
  }, [tableId, page, pageSize, filterCategory]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // 定时刷新
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => loadLogs(), 5000);
    return () => clearInterval(interval);
  }, [loadLogs, autoRefresh]);

  // WebSocket实时推送
  useEffect(() => {
    if (!tableId) return;
    const ws = api.createWebSocket(tableId);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
          // 实时追加新日志到列表顶部
          setLogs(prev => [data.data, ...prev].slice(0, 500));
        }
      } catch (e) {
        // 忽略非JSON消息或解析错误
      }
    };

    ws.onclose = () => {
      setTimeout(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          const newWs = api.createWebSocket(tableId!);
          wsRef.current = newWs;
        }
      }, 3000);
    };

    return () => ws.close();
  }, [tableId]);

  // 筛选后的数据
  const filteredLogs = logs.filter(l => {
    if (filterCategory && l.category !== filterCategory) return false;
    if (filterPriority && l.priority !== filterPriority) return false;
    if (searchText && !(
      l.description.toLowerCase().includes(searchText.toLowerCase()) ||
      l.event_type.includes(searchText) ||
      String(l.game_number).includes(searchText)
    )) return false;
    return true;
  });

  // 统计
  const stats = {
    total: filteredLogs.length,
    pinned: filteredLogs.filter(l => l.is_pinned).length,
    errors: filteredLogs.filter(l => ['P0', 'P1'].includes(l.priority)).length,
    byCategory: {} as Record<string, number>,
  };
  filteredLogs.forEach(l => {
    stats.byCategory[l.category] = (stats.byCategory[l.category] || 0) + 1;
  });

  // 表格列定义
  const columns: ColumnsType<LogEntry> = [
    {
      title: '时间',
      dataIndex: 'log_time',
      width: 85,
      render: (v: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {v ? dayjs(v).format('HH:mm:ss') : ''}
        </span>
      ),
      sorter: (a, b) => dayjs(a.log_time).valueOf() - dayjs(b.log_time).valueOf(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '局号',
      dataIndex: 'game_number',
      width: 55,
      render: (v: number | null) => v ?? '-',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 58,
      render: (v: string) => (
        <Tag color={PRIORITY_COLORS[v]} style={{ fontSize: 11, fontWeight: 600 }}>
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
      width: 65,
      render: (v: string) => (
        <Tag style={{ fontSize: 11 }}>{v}</Tag>
      ),
    },
    {
      title: '事件',
      dataIndex: 'event_type',
      width: 90,
      render: (v: string, record: LogEntry) => (
        <Space size={4}>
          {record.is_pinned && <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
          <span style={{ fontWeight: 500, color: PRIORITY_COLORS[record.priority] || '#58a6ff' }}>
            {v}
          </span>
        </Space>
      ),
    },
    {
      title: '结果',
      dataIndex: 'event_result',
      width: 60,
      render: (v: string) =>
        v === '成功'
          ? <Tag color="success" style={{ fontSize: 11 }}>✓</Tag>
          : v === '失败'
            ? <Tag color="error" style={{ fontSize: 11 }}>✗</Tag>
            : '-',
    },
    {
      title: '说明',
      dataIndex: 'description',
      ellipsis: true,
      render: (v: string) => (
        <Tooltip title={v}>
          <span style={{ cursor: 'pointer', fontSize: 12 }}>{v}</span>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      width: 50,
      fixed: 'right' as const,
      render: (_: any, r: LogEntry) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0 }}
          onClick={() => { setSelectedLog(r); setDetailModalOpen(true); }}
        >
          详情
        </Button>
      ),
    },
  ];

  // 时间线视图数据（最近20条）
  const recentLogs = filteredLogs.slice(0, 20);

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
            <FileTextOutlined style={{ marginRight: 8 }} />
            实盘日志 — {tableId}
          </span>

          {/* 统计Badge */}
          <Space size="small">
            <Badge count={stats.total} showZero style={{ backgroundColor: '#58a6ff' }} overflowCount={9999} />
            {stats.errors > 0 && (
              <Badge count={`${stats.errors}个告警`} style={{ backgroundColor: '#ff4d4f' }} />
            )}
            {stats.pinned > 0 && (
              <Badge count={`${stats.pinned}个置顶`} style={{ backgroundColor: '#faad14' }} />
            )}
          </Space>
        </Space>

        <Space size="middle">
          <Switch
            size="small"
            checked={autoRefresh}
            onChange={setAutoRefresh}
            checkedChildren="自动刷新"
            unCheckedChildren="停止"
          />
          <Switch
            size="small"
            checked={autoScroll}
            onChange={setAutoScroll}
            checkedChildren="自动滚动"
            unCheckedChildren="固定"
          />
          <Button icon={<ReloadOutlined />} size="small" onClick={() => loadLogs()}>
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} size="small" onClick={exportToCSV} title="导出CSV">
            CSV
          </Button>
          <Button icon={<DownloadOutlined />} size="small" onClick={exportToJSON} title="导出JSON">
            JSON
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {/* 左侧：主日志表格 */}
        <Col span={17}>
          {/* 筛选栏 */}
          <Card size="small" style={{ marginBottom: 12 }}>
            <Space size="middle" wrap>
              <FilterOutlined /> <strong style={{ color: '#8b949e' }}>筛选：</strong>

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
                prefix={<SearchOutlined />}
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

          {/* 日志表格 */}
          <Spin spinning={loading}>
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
                scroll={{ y: 'calc(100vh - 380px)', x: 800 }}
                locale={{ emptyText: <Empty description="暂无日志记录" /> }}
                rowClassName={(record) => {
                  if (record.is_pinned) return 'log-pinned';
                  if (record.priority === 'P0') return 'log-critical';
                  if (record.priority === 'P1') return 'log-error';
                  return '';
                }}
              />
            </Card>
          </Spin>
        </Col>

        {/* 右侧：时间线 + 统计 */}
        <Col span={7}>
          {/* 告警面板 */}
          {(stats.errors > 0) && (
            <Alert
              message={`当前有 ${stats.errors} 个未处理的严重问题`}
              type="error"
              showIcon
              icon={<WarningOutlined />}
              style={{ marginBottom: 12 }}
            />
          )}

          {/* 实时时间线 */}
          <Card
            title={<span><ClockCircleOutlined /> 最近事件</span>}
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
                      {log.is_pinned && <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 11 }} />}
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
          <Card title={<span>📊 分类统计</span>} size="small">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(stats.byCategory).map(([cat, count]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Tag style={{ margin: 0 }}>{cat}</Tag>
                  <span style={{ fontWeight: 600, color: '#58a6ff' }}>{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

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
            <Row>
              <Col span={8} style={{ color: '#8b949e' }}>事件编码：</Col>
              <Col span={16}><code>{selectedLog.event_code}</code></Col>
            </Row>
            <Row>
              <Col span={8} style={{ color: '#8b949e' }}>发生时间：</Col>
              <Col span={16}>{selectedLog.log_time ? dayjs(selectedLog.log_time).format('YYYY-MM-DD HH:mm:ss.SSS') : '-'}</Col>
            </Row>
            <Row>
              <Col span={8} style={{ color: '#8b949e' }}>关联局号：</Col>
              <Col span={16}>{selectedLog.game_number ?? '全局事件'}</Col>
            </Row>
            <Row>
              <Col span={8} style={{ color: '#8b949e' }}>事件类型：</Col>
              <Col span={16}><strong>{selectedLog.event_type}</strong></Col>
            </Row>
            <Row>
              <Col span={8} style={{ color: '#8b949e' }}>执行结果：</Col>
              <Col span={16}>
                {selectedLog.event_result === '成功'
                  ? <Tag color="success"><CheckCircleOutlined /> 成功</Tag>
                  : selectedLog.event_result === '失败'
                    ? <Tag color="error"><WarningOutlined /> 失败</Tag>
                    : '-'}
              </Col>
            </Row>
            <Row>
              <Col span={8} style={{ color: '#8b949e' }}>事件类别：</Col>
              <Col span={16}><Tag>{selectedLog.category}</Tag></Col>
            </Row>
            <Row>
              <Col span={8} style={{ color: '#8b949e' }}>优先级：</Col>
              <Col span={16}>
                <Tag color={PRIORITY_COLORS[selectedLog.priority]} style={{ fontWeight: 600 }}>
                  {selectedLog.priority}
                </Tag>
                {selectedLog.is_pinned && <Tag color="#ff4d4f">📌 已置顶</Tag>}
              </Col>
            </Row>
            <Row>
              <Col span={8} style={{ color: '#8b949e' }}>详细描述：</Col>
              <Col span={16}>
                <div style={{
                  background: '#161b22',
                  padding: 12,
                  borderRadius: 6,
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {selectedLog.description}
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* 内联样式 */}
      <style>{`
        .log-pinned {
          background-color: rgba(250, 173, 20, 0.08) !important;
          border-left: 3px solid #faad14 !important;
        }
        .log-critical {
          background-color: rgba(255, 77, 79, 0.08) !important;
          border-left: 3px solid #ff4d4f !important;
        }
        .log-error {
          background-color: rgba(255, 173, 0, 0.05) !important;
          border-left: 3px solid #faad14 !important;
        }
        .ant-table-small .ant-table-cell {
          padding: 4px 8px !important;
          font-size: 12px;
        }
        .ant-timeline-item-content {
          font-size: 12px !important;
        }
      `}</style>
    </div>
  );
};

export default LogsPage;
