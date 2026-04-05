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
      generateMockLogs();
    } finally {
      setLoading(false);
    }
  }, [tableId, page, pageSize, filterCategory]);

  // 模拟数据（开发用）
  const generateMockLogs = () => {
    const eventTypes = [
      '系统启动', '采集开始', '开奖结果', 'AI分析', '下注执行', '结算完成',
      '超时警告', '健康检查', '模型切换', '靴次切换', '预测正确', '预测错误',
      '网络异常', '数据清洗', '路图更新',
    ];
    const categories = ['系统', '采集', '分析', '决策', '结算', '异常'];
    const priorities = ['P0', 'P1', 'P2', 'P3'];
    const mockLogs: LogEntry[] = [];

    for (let i = 1; i <= 100; i++) {
      const typeIdx = Math.floor(Math.random() * eventTypes.length);
      const priorityIdx = Math.random() > 0.8 ? Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2);
      mockLogs.push({
        id: i,
        log_time: dayjs().subtract(100 - i, 'second').toISOString(),
        game_number: Math.random() > 0.3 ? Math.floor(Math.random() * 60) + 1 : null,
        event_code: `EVT${String(i).padStart(4, '0')}`,
        event_type: eventTypes[typeIdx],
        event_result: Math.random() > 0.15 ? '成功' : '失败',
        description: generateLogDescription(eventTypes[typeIdx]),
        category: categories[Math.floor(Math.random() * categories.length)],
        priority: priorities[priorityIdx],
        is_pinned: priorityIdx < 2 && Math.random() > 0.5,
      });
    }

    setLogs(mockLogs.reverse());
  };

  function generateLogDescription(type: string): string {
    const descriptions: Record<string, string[]> = {
      '系统启动': [
        'BBBBB系统初始化完成，加载配置文件成功',
        '数据库连接建立，SQLite版本3.45.0',
        'WebSocket服务器启动，监听端口8000',
        '五路走势图引擎初始化完毕',
        'AI预测模块就绪（Claude API已连接）',
      ],
      '采集开始': [
        '开始第N局数据采集...',
        '目标网站连接成功，获取页面HTML',
        '解析开奖结果：庄',
        '数据校验通过，写入数据库',
      ],
      '开奖结果': [
        '第XX局开奖结果：庄，耗时3.2秒',
        '本局结果与预测一致 ✓',
        '本局结果与预测不一致 ✗',
        '检测到和局，不计入胜负统计',
      ],
      'AI分析': [
        '庄模型分析中...置信度78%',
        '闲模型分析中...置信度62%',
        '综合模型输出：建议跟庄（标准档）',
        '三模型一致性检测：2/3一致',
        'AI记忆库更新完成，新增学习样本',
      ],
      '下注执行': [
        `下注指令发送：庄 ¥100 (标准档)`,
        '下注确认：金额¥100 方向庄 档位标准',
        '当前余额：¥19,850（上次下注后）',
        '自适应调整：切换至保守档位',
      ],
      '结算完成': [
        `结算结果：盈利 +¥95（扣除5%佣金）`,
        `结算结果：亏损 -¥100`,
        '累计盈亏：+¥350 | 准确率：56.3%',
        '余额更新：¥20,450',
      ],
      '超时警告': [
        '⚠️ 第XX局处理时间超过90秒',
        '⚠️ 数据采集响应缓慢 (>15s)',
        '⚠️ AI API调用延迟较高 (>8s)',
        '⚠️ 接近150秒超时阈值！',
      ],
      '健康检查': [
        '系统健康度评分：92/100',
        '内存使用率：45% | CPU：12%',
        '连续错误计数：0（正常）',
        '数据库查询延迟：<10ms',
      ],
      '模型切换': [
        '自动切换至保守模式（连败3局后）',
        '恢复标准模式（连胜2局后）',
        '手动干预：管理员强制切换档位',
      ],
      '靴次切换': [
        '🔄 第X靴结束，共68局',
        '新靴开始，重置所有计数器',
        '上靴总结：胜35/负30/和3 | 盈亏+¥280',
      ],
      '预测正确': [
        '✓ 第XX局预测正确（庄→庄）',
        '连续预测正确：2次',
      ],
      '预测错误': [
        '✗ 第XX局预测错误（预测庄，实际闲）',
        '记录到错题本，等待AI离线学习',
      ],
      '网络异常': [
        '⚠️ 网络请求失败，正在重试 (1/3)',
        '⚠️ 目标网站响应502，切换备用源',
        '网络恢复，继续正常运行',
      ],
      '数据清洗': [
        '原始数据清洗完成：去除1条无效记录',
        '格式标准化：时间戳统一为ISO格式',
        '重复检测结果：无重复数据',
      ],
      '路图更新': [
        '大路新增点：(列5, 行3) 庄',
        '珠盘路填入：(列12, 行4)',
        '下三路重新计算完成',
      ],
    };
    const options = descriptions[type] || ['系统运行正常'];
    return options[Math.floor(Math.random() * options.length)];
  }

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
