/**
 * 错题本页面 - 预测错误记录、错因分析、修正策略
 * 路由：/dashboard/:tableId/mistakes
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Table, Tag, Space, Row, Col, Statistic,
  Select, Input, Modal, Spin, Empty, Descriptions, Tooltip,
  Alert, Progress, Badge,
} from 'antd';
import {
  ArrowLeftOutlined, ReloadOutlined, SearchOutlined,
  FilterOutlined, ExperimentOutlined, WarningOutlined,
  CheckCircleOutlined, BulbOutlined, ThunderboltOutlined,
  QuestionCircleOutlined, AimOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import * as api from '../services/api';
import type { MistakeRecord } from '../services/api';

// 错误类型映射
const ERROR_TYPE_MAP: Record<string, { color: string; label: string; desc: string }> = {
  '趋势误判':     { color: '#ff4d4f', label: '趋势误判',   desc: '对连续走势方向判断失误' },
  '转折误判':     { color: '#faad14', label: '转折误判',   desc: '未能识别趋势转折点' },
  '置信过高':     { color: '#722ed1', label: '置信过高',   desc: '高置信度但预测错误' },
  '样本不足':     { color: '#1890ff', label: '样本不足',   desc: '数据量不足以支撑判断' },
  '结算映射异常': { color: '#ff7a45', label: '结算异常',   desc: '开奖结果与下注方向映射出错' },
};

interface MistakeSummary {
  totalErrors: number;
  byType: Record<string, number>;
  byDirection: { banker: number; player: number };
  avgConfidence: number;
  latestBootNumber: number | null;
}

const MistakeBookPage: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  // 数据
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<MistakeSummary | null>(null);

  // 分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 筛选
  const [filterErrorType, setFilterErrorType] = useState<string>('');
  const [filterPredictDir, setFilterPredictDir] = useState<string>('');
  const [searchGameNumber, setSearchGameNumber] = useState('');

  // 详情弹窗
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedMistake, setSelectedMistake] = useState<MistakeRecord | null>(null);

  // 加载错题记录
  const loadMistakes = useCallback(async (p = page) => {
    if (!tableId) return;
    setLoading(true);
    try {
      const res = await api.getMistakeRecords({
        table_id: tableId,
        page: p,
        page_size: pageSize,
      });
      // 后端返回的 data 是字典数组，需要映射为 MistakeRecord
      const rawData = res.data.data || [];
      const mapped: MistakeRecord[] = rawData.map((r: any) => ({
        id: r.id,
        table_id: r.table_id,
        boot_number: r.boot_number,
        game_number: r.game_number,
        error_id: r.error_id,
        error_type: r.error_type,
        predict_direction: r.predict_direction,
        actual_result: r.actual_result,
        banker_summary: r.banker_summary,
        player_summary: r.player_summary,
        combined_summary: r.combined_summary,
        confidence: r.confidence,
        road_snapshot: r.road_snapshot ? (typeof r.road_snapshot === 'string' ? JSON.parse(r.road_snapshot) : r.road_snapshot) : null,
        analysis: r.analysis,
        correction: r.correction,
        created_at: r.created_at,
      }));
      setMistakes(mapped);
      calcSummary(mapped);
    } catch (err) {
      console.warn('加载错题本数据失败（可能暂无记录）:', err);
      setMistakes([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [tableId, page, pageSize]);

  // 计算汇总
  const calcSummary = (data: MistakeRecord[]) => {
    if (!data.length) return;

    const byType: Record<string, number> = {};
    let bankerErr = 0;
    let playerErr = 0;
    let totalConf = 0;
    let confCount = 0;
    let latestBoot: number | null = null;

    data.forEach(m => {
      byType[m.error_type] = (byType[m.error_type] || 0) + 1;
      if (m.predict_direction === '庄') bankerErr++;
      else if (m.predict_direction === '闲') playerErr++;
      if (m.confidence !== null && m.confidence !== undefined) {
        totalConf += m.confidence;
        confCount++;
      }
      if (!latestBoot || m.boot_number > latestBoot) latestBoot = m.boot_number;
    });

    setSummary({
      totalErrors: data.length,
      byType,
      byDirection: { banker: bankerErr, player: playerErr },
      avgConfidence: confCount > 0 ? totalConf / confCount : 0,
      latestBootNumber: latestBoot,
    });
  };

  useEffect(() => {
    loadMistakes();
  }, [loadMistakes]);

  // 自动刷新（每20秒）
  useEffect(() => {
    const interval = setInterval(() => loadMistakes(), 20000);
    return () => clearInterval(interval);
  }, [loadMistakes]);

  // 筛选后的数据
  const filtered = mistakes.filter(m => {
    if (filterErrorType && m.error_type !== filterErrorType) return false;
    if (filterPredictDir && m.predict_direction !== filterPredictDir) return false;
    if (searchGameNumber && !String(m.game_number).includes(searchGameNumber)) return false;
    return true;
  });

  // 表格列定义
  const columns: ColumnsType<MistakeRecord> = [
    {
      title: '局号',
      dataIndex: 'game_number',
      width: 65,
      sorter: (a, b) => a.game_number - b.game_number,
    },
    {
      title: '靴号',
      dataIndex: 'boot_number',
      width: 55,
      render: (v: number) => <span style={{ color: '#8b949e' }}>#{v}</span>,
    },
    {
      title: '错误类型',
      dataIndex: 'error_type',
      width: 100,
      render: (v: string) => {
        const info = ERROR_TYPE_MAP[v];
        return info
          ? <Tag color={info.color} style={{ fontWeight: 500 }}>{info.label}</Tag>
          : <Tag>{v}</Tag>;
      },
    },
    {
      title: '预测→实际',
      width: 110,
      render: (_: any, r: MistakeRecord) => (
        <Space size={2}>
          <Tag color={r.predict_direction === '庄' ? '#ff4d4f' : '#1890ff'} style={{ fontSize: 11 }}>
            {r.predict_direction}
          </Tag>
          <span style={{ color: '#ff4d4f', fontWeight: 700 }}>✗</span>
          <Tag color={r.actual_result === '庄' ? '#ff4d4f' : '#1890ff'} style={{ fontSize: 11 }}>
            {r.actual_result}
          </Tag>
        </Space>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      width: 80,
      render: (v: number | null) =>
        v !== null ? (
          <Progress
            percent={Math.round(v * 100)}
            size="small"
            strokeColor={v >= 0.75 ? '#ff4d4f' : v >= 0.5 ? '#faad14' : '#52c41a'}
            format={(p) => `${p}%`}
          />
        ) : <span style={{ color: '#555' }}>-</span>,
    },
    {
      title: '错因分析',
      dataIndex: 'analysis',
      width: 200,
      ellipsis: true,
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <span style={{ fontSize: 12, color: '#c9d1d9' }}>{v}</span>
          </Tooltip>
        ) : <span style={{ color: '#555' }}>-</span>,
    },
    {
      title: '修正策略',
      dataIndex: 'correction',
      width: 180,
      ellipsis: true,
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <span style={{ fontSize: 12, color: '#79c077' }}>{v}</span>
          </Tooltip>
        ) : <span style={{ color: '#555' }}>-</span>,
    },
    {
      title: '操作',
      width: 60,
      fixed: 'right' as const,
      render: (_: any, r: MistakeRecord) => (
        <Button
          type="link"
          size="small"
          onClick={() => { setSelectedMistake(r); setDetailModalOpen(true); }}
        >
          详情
        </Button>
      ),
    },
  ];

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
            <ExperimentOutlined style={{ marginRight: 8 }} />
            错题本 — {tableId}
          </span>
          <Badge count={filtered.length} showZero style={{ backgroundColor: filtered.length > 10 ? '#ff4d4f' : '#58a6ff' }} />
        </Space>

        <Space size="middle">
          <Button icon={<ReloadOutlined />} size="small" onClick={() => loadMistakes(1)}>
            刷新
          </Button>
        </Space>
      </div>

      {/* 提示信息 */}
      <Alert
        type="info"
        icon={<BulbOutlined />}
        message="错题本记录了每次预测错误的详细分析。通过复盘错因和修正策略，系统会在后续预测中自动规避类似错误。"
        showIcon
        closable
        style={{ marginBottom: 16 }}
      />

      {/* 统计卡片 */}
      {summary && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col span={3}>
            <Card size="small">
              <Statistic
                title="总错误数"
                value={summary.totalErrors}
                suffix="条"
                styles={{ content: { fontSize: 18, color: summary.totalErrors > 15 ? '#ff4d4f' : '#58a6ff' } }}
              />
            </Card>
          </Col>
          <Col span={3}>
            <Card size="small">
              <Statistic
                title="平均置信度"
                value={(summary.avgConfidence * 100).toFixed(0)}
                suffix="%"
                prefix={<ThunderboltOutlined />}
                styles={{ content: { fontSize: 18, color: summary.avgConfidence > 0.7 ? '#722ed1' : '#52c41a' } }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small" title="方向分布">
              <Space size="large">
                <Statistic
                  value={summary.byDirection.banker}
                  prefix={<span style={{ color: '#ff4d4f' }}>庄</span>}
                  suffix="误"
                  valueStyle={{ fontSize: 16 }}
                />
                <Statistic
                  value={summary.byDirection.player}
                  prefix={<span style={{ color: '#1890ff' }}>闲</span>}
                  suffix="误"
                  valueStyle={{ fontSize: 16 }}
                />
              </Space>
            </Card>
          </Col>

          {/* 错误类型占比 */}
          {Object.keys(summary.byType).map(type => {
            const count = summary.byType[type];
            const info = ERROR_TYPE_MAP[type];
            return (
              <Col key={type} span={3}>
                <Card size="small">
                  <Statistic
                    title={info?.label || type}
                    value={count}
                    valueStyle={{ fontSize: 18, color: info?.color || '#888' }}
                  />
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* 筛选栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <FilterOutlined /> <strong style={{ color: '#8b949e' }}>筛选：</strong>

          <Select
            placeholder="错误类型"
            allowClear
            value={filterErrorType || undefined}
            onChange={setFilterErrorType}
            style={{ width: 130 }}
            size="small"
            options={Object.entries(ERROR_TYPE_MAP).map(([k, v]) => ({ label: v.label, value: k }))}
          />

          <Select
            placeholder="预测方向"
            allowClear
            value={filterPredictDir || undefined}
            onChange={setFilterPredictDir}
            style={{ width: 110 }}
            size="small"
            options={[
              { label: '庄', value: '庄' },
              { label: '闲', value: '闲' },
            ]}
          />

          <Input
            placeholder="搜索局号"
            size="small"
            value={searchGameNumber}
            onChange={(e) => setSearchGameNumber(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 120 }}
          />

          <Button
            size="small"
            onClick={() => {
              setFilterErrorType('');
              setFilterPredictDir('');
              setSearchGameNumber('');
            }}
          >
            重置
          </Button>

          <span style={{ marginLeft: 24, color: '#8b949e', fontSize: 13 }}>
            共 {filtered.length} 条记录
          </span>
        </Space>
      </Card>

      {/* 数据表格 */}
      <Spin spinning={loading}>
        <Card size="small">
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey={(r) => `mistake-${r.id}-${r.game_number}`}
            size="small"
            pagination={{
              current: page,
              pageSize,
              total: filtered.length,
              onChange: (p, ps) => { setPage(p); if (ps !== pageSize) setPageSize(ps); },
              showTotal: (total) => `共 ${total} 条`,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ['10', '20', '50'],
              size: 'small',
            }}
            scroll={{ x: 950, y: 'calc(100vh - 480px)' }}
            locale={{ emptyText: <Empty description={
              <span>
                暂无错题记录<br />
                <span style={{ color: '#8b949e', fontSize: 12 }}>预测正确时不会产生错题记录 ✅</span>
              </span>
            } /> }}
            rowClassName={() => 'row-mistake'}
          />
        </Card>
      </Spin>

      {/* 详情弹窗 */}
      <Modal
        title={`错题详情 - 第${selectedMistake?.game_number}局`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[<Button key="close" onClick={() => setDetailModalOpen(false)}>关闭</Button>]}
        width={680}
      >
        {selectedMistake && (
          <>
            <Descriptions bordered column={2} size="small" labelStyle={{ width: 100, background: '#161b22' }} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="桌号">{selectedMistake.table_id}</Descriptions.Item>
              <Descriptions.Item label="靴号">#{selectedMistake.boot_number}</Descriptions.Item>
              <Descriptions.Item label="局号">{selectedMistake.game_number}</Descriptions.Item>
              <Descriptions.Item label="错误编号">{selectedMistake.error_id}</Descriptions.Item>
              <Descriptions.Item label="错误类型">
                <Tag color={ERROR_TYPE_MAP[selectedMistake.error_type]?.color}>{ERROR_TYPE_MAP[selectedMistake.error_type]?.label || selectedMistake.error_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="置信度">
                {selectedMistake.confidence !== null ? (
                  <Progress percent={Math.round(selectedMistake.confidence * 100)} size="small"
                    strokeColor={selectedMistake.confidence >= 0.75 ? '#ff4d4f' : '#faad14'} format={p => `${p}%`} />
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="预测方向" span={2}>
                <Space>
                  <Tag color="#ff4d4f">预测: {selectedMistake.predict_direction}</Tag>
                  <span style={{ color: '#ff4d4f', fontSize: 16 }}>✗</span>
                  <Tag color="#1890ff">实际: {selectedMistake.actual_result}</Tag>
                </Space>
              </Descriptions.Item>
            </Descriptions>

            {/* 三模型摘要 */}
            <Card
              size="small"
              title={<><AimOutlined /> AI模型分析摘要</>}
              style={{ marginBottom: 12 }}
              styles={{ header: { background: '#161b22', color: '#e6edf3' } }}
            >
              {selectedMistake.banker_summary && (
                <Alert type="error" message="庄模型" description={selectedMistake.banker_summary} style={{ marginBottom: 8 }} />
              )}
              {selectedMistake.player_summary && (
                <Alert type="warning" message="闲模型" description={selectedMistake.player_summary} style={{ marginBottom: 8 }} />
              )}
              {selectedMistake.combined_summary && (
                <Alert type="error" message="综合模型" description={selectedMistake.combined_summary} />
              )}
              {!selectedMistake.banker_summary && !selectedMistake.player_summary && !selectedMistake.combined_summary && (
                <span style={{ color: '#555' }}>无AI模型分析摘要</span>
              )}
            </Card>

            {/* 错因分析与修正策略 */}
            <Row gutter={12}>
              <Col span={12}>
                <Card
                  size="small"
                  title={<><WarningOutlined /> 错因分析</>}
                  styles={{ header: { background: '#2d1318', color: '#ff4d4f' } }}
                >
                  <p style={{ color: '#c9d1d9', lineHeight: 1.8, margin: 0 }}>
                    {selectedMistake.analysis || <span style={{ color: '#555' }}>暂无分析</span>}
                  </p>
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  size="small"
                  title={<><CheckCircleOutlined /> 修正策略</>}
                  styles={{ header: { background: '#132d1c', color: '#52c41a' } }}
                >
                  <p style={{ color: '#c9d1d9', lineHeight: 1.8, margin: 0 }}>
                    {selectedMistake.correction || <span style={{ color: '#555' }}>暂无修正策略</span>}
                  </p>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Modal>

      {/* 内联样式 */}
      <style>{`
        .row-mistake { background-color: rgba(255, 77, 79, 0.04) !important; }
        .row-mistake:hover { background-color: rgba(255, 77, 79, 0.08) !important; }
        .ant-descriptions-item-label { font-weight: 500 !important; }
        .ant-alert-message { font-weight: 600 !important; }
      `}</style>
    </div>
  );
};

export default MistakeBookPage;
