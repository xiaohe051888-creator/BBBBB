/**
 * 错题本页面 - 预测错误记录、错因分析、修正策略
 * 路由：/dashboard/mistakes
 * 
 * 优化：使用React Query + 乐观UI策略，自适应布局无横向滚动
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Table, Tag, Space, Statistic,
  Select, Input, Modal, Empty, Descriptions, Tooltip,
  Alert, Progress, Badge, Grid,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMistakesQuery, type MistakeRecord } from '../hooks';
import { useQueryClient } from '@tanstack/react-query';

// 错误类型映射
const ERROR_TYPE_MAP: Record<string, { color: string; label: string; desc: string }> = {
  '趋势误判':     { color: '#ff4d4f', label: '趋势误判',   desc: '对连续走势方向判断失误' },
  '转折误判':     { color: '#faad14', label: '转折误判',   desc: '未能识别趋势转折点' },
  '置信过高':     { color: '#722ed1', label: '置信过高',   desc: '高置信度但预测错误' },
  '样本不足':     { color: '#1890ff', label: '样本不足',   desc: '数据量不足以支撑判断' },
  '结算映射异常': { color: '#ff7a45', label: '结算异常',   desc: '开奖结果与下注方向映射出错' },
};

// 精致图标组件
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
  Experiment: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.8 18.4L14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4c-.49.66-.02 1.6.8 1.6h14c.82 0 1.29-.94.8-1.6z"/>
    </svg>
  ),
  Bulb: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/>
    </svg>
  ),
  Thunder: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/>
    </svg>
  ),
  Warning: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  Aim: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z"/>
    </svg>
  ),
};

interface MistakeSummary {
  totalErrors: number;
  byType: Record<string, number>;
  byDirection: { banker: number; player: number };
  avgConfidence: number;
  latestBootNumber: number | null;
}

const MistakeBookPage: React.FC = () => {
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  // 分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // React Query获取数据（乐观UI：立即显示缓存数据）
  const { data: mistakesData } = useMistakesQuery({});

  // 使用useMemo缓存数据，避免useMemo依赖变化
  const mistakes = useMemo(() => mistakesData?.mistakes || [], [mistakesData]);
  const total = useMemo(() => mistakesData?.total || 0, [mistakesData]);

  // 筛选状态
  const [filterErrorType, setFilterErrorType] = useState<string>('');
  const [filterPredictDir, setFilterPredictDir] = useState<string>('');
  const [searchGameNumber, setSearchGameNumber] = useState('');

  // 详情弹窗
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedMistake, setSelectedMistake] = useState<MistakeRecord | null>(null);

  // 手动刷新
  const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['mistakes'] });
  };

  // 计算汇总（使用useMemo优化性能）
  const summary: MistakeSummary | null = useMemo(() => {
    if (!mistakes.length) return null;

    const byType: Record<string, number> = {};
    let bankerErr = 0;
    let playerErr = 0;
    let totalConf = 0;
    let confCount = 0;
    let latestBoot: number | null = null;

    mistakes.forEach(m => {
      byType[m.error_type] = (byType[m.error_type] || 0) + 1;
      if (m.predict_direction === '庄') bankerErr++;
      else if (m.predict_direction === '闲') playerErr++;
      if (m.confidence !== null && m.confidence !== undefined) {
        totalConf += m.confidence;
        confCount++;
      }
      if (!latestBoot || m.boot_number > latestBoot) latestBoot = m.boot_number;
    });

    return {
      totalErrors: total,
      byType,
      byDirection: { banker: bankerErr, player: playerErr },
      avgConfidence: confCount > 0 ? totalConf / confCount : 0,
      latestBootNumber: latestBoot,
    };
  }, [mistakes, total]);

  // 筛选后的数据（客户端筛选）
  const filtered = useMemo(() => {
    return mistakes.filter(m => {
      if (filterErrorType && m.error_type !== filterErrorType) return false;
      if (filterPredictDir && m.predict_direction !== filterPredictDir) return false;
      if (searchGameNumber && !String(m.game_number).includes(searchGameNumber)) return false;
      return true;
    });
  }, [mistakes, filterErrorType, filterPredictDir, searchGameNumber]);

  // 表格列定义 - 自适应宽度，无横向滚动
  const columns: ColumnsType<MistakeRecord> = [
    {
      title: '局号',
      dataIndex: 'game_number',
      width: '10%',
      align: 'center',
      sorter: (a, b) => a.game_number - b.game_number,
    },
    {
      title: '靴号',
      dataIndex: 'boot_number',
      width: '10%',
      align: 'center',
      render: (v: number) => <span style={{ color: '#8b949e', fontSize: 12 }}>#{v}</span>,
    },
    {
      title: '错误类型',
      dataIndex: 'error_type',
      width: '15%',
      align: 'center',
      render: (v: string) => {
        const info = ERROR_TYPE_MAP[v];
        return info
          ? <Tag color={info.color} style={{ fontWeight: 500, fontSize: 11 }}>{info.label}</Tag>
          : <Tag style={{ fontSize: 11 }}>{v}</Tag>;
      },
    },
    {
      title: '预测→实际',
      width: '18%',
      align: 'center',
      render: (_: unknown, record: MistakeRecord) => (
        <Space size={2} style={{ justifyContent: 'center' }}>
          <Tag color={record.predict_direction === '庄' ? '#ff4d4f' : '#1890ff'} style={{ fontSize: 11, padding: '0 6px' }}>
            {record.predict_direction}
          </Tag>
          <span style={{ color: '#ff4d4f', fontWeight: 700 }}>✗</span>
          <Tag color={record.actual_result === '庄' ? '#ff4d4f' : '#1890ff'} style={{ fontSize: 11, padding: '0 6px' }}>
            {record.actual_result}
          </Tag>
        </Space>
      ),
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      width: '15%',
      align: 'center',
      render: (v: number | null) =>
        v !== null ? (
          <Progress
            percent={Math.round(v * 100)}
            size="small"
            strokeColor={v >= 0.75 ? '#ff4d4f' : v >= 0.5 ? '#faad14' : '#52c41a'}
            format={(p) => <span style={{ fontSize: 11 }}>{p}%</span>}
            style={{ margin: 0 }}
          />
        ) : <span style={{ color: '#555' }}>-</span>,
    },
    {
      title: '错因分析',
      dataIndex: 'analysis',
      width: '22%',
      ellipsis: true,
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <span style={{ fontSize: 12, color: '#c9d1d9' }}>{v}</span>
          </Tooltip>
        ) : <span style={{ color: '#555' }}>-</span>,
    },
    {
      title: '操作',
      width: '10%',
      align: 'center',
      render: (_: unknown, record: MistakeRecord) => (
        <Button
          type="link"
          size="small"
          onClick={() => { setSelectedMistake(record); setDetailModalOpen(true); }}
          style={{ fontSize: 12, padding: '0 4px' }}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className="page-wrapper mistakes-page" style={{ padding: '16px', maxWidth: '100%' }}>
      {/* 顶部导航 */}
      <div className="page-nav-bar" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div className="page-nav-left" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button icon={<Icons.Back />} onClick={() => navigate("/dashboard")} size="small">
            返回
          </Button>
          <span className="page-nav-title" style={{ fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Experiment />
            错题本 
          </span>
          <Badge count={filtered.length} showZero style={{ backgroundColor: filtered.length > 10 ? '#ff4d4f' : '#58a6ff' }} />
        </div>
        <div className="page-nav-right mobile-action-row">
          <Button 
            icon={<Icons.Refresh />} 
            size="small" 
            onClick={handleRefresh}
          >
            刷新
          </Button>
        </div>
      </div>

      {/* 提示信息 */}
      <Alert
        title="系统说明"
        description="预测准确时不生成错题记录，仅在预测失误时保存完整现场供后续深度学习"
        type="info"
        showIcon
        style={{ marginBottom: 24, background: 'rgba(24,144,255,0.1)', border: '1px solid rgba(24,144,255,0.2)' }}
      />

      {/* 统计卡片 — 响应式网格 */}
      {summary && (
        <div className="stats-grid" style={{ 
          marginBottom: 16, 
          display: 'grid', 
          gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? 150 : 140}px, 1fr))`,
          gap: 12 
        }}>
          <Card size="small">
            <Statistic
              title="总错误数"
              value={summary.totalErrors}
              suffix="条"
              styles={{ content: { fontSize: 18, color: summary.totalErrors > 15 ? '#ff4d4f' : '#58a6ff' } }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title="平均置信度"
              value={(summary.avgConfidence * 100).toFixed(0)}
              suffix="%"
              styles={{ content: { fontSize: 18, color: summary.avgConfidence > 0.7 ? '#722ed1' : '#52c41a' } }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title="庄向误判"
              value={summary.byDirection.banker}
              styles={{ content: { fontSize: 16, color: '#ff4d4f' } }}
            />
          </Card>
          <Card size="small">
            <Statistic
              title="闲向误判"
              value={summary.byDirection.player}
              styles={{ content: { fontSize: 16, color: '#1890ff' } }}
            />
          </Card>
          {Object.keys(summary.byType).map(type => {
            const count = summary.byType[type];
            const info = ERROR_TYPE_MAP[type];
            return (
              <Card size="small" key={type}>
                <Statistic
                  title={info?.label || type}
                  value={count}
                  styles={{ content: { fontSize: 18, color: info?.color || '#888' } }}
                />
              </Card>
            );
          })}
        </div>
      )}

      {/* 筛选栏 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space size="middle" wrap style={{ width: '100%' }} className="mobile-action-row">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8b949e' }}>
            <Icons.Filter /> <strong>筛选：</strong>
          </span>

          <Select
            placeholder="错误类型"
            allowClear
            value={filterErrorType || undefined}
            onChange={setFilterErrorType}
            className="mobile-fill-control"
            style={{ width: 130 }}
            size="small"
            options={Object.entries(ERROR_TYPE_MAP).map(([k, v]) => ({ label: v.label, value: k }))}
          />

          <Select
            placeholder="预测方向"
            allowClear
            value={filterPredictDir || undefined}
            onChange={setFilterPredictDir}
            className="mobile-fill-control"
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
            prefix={<Icons.Search />}
            className="mobile-fill-control"
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

          <span style={{ marginLeft: isMobile ? 0 : 'auto', color: '#8b949e', fontSize: 13 }}>
            共 {filtered.length} 条记录
          </span>
        </Space>
      </Card>

      {/* 数据表格 - 自适应布局，无横向滚动 */}
      <Card size="small">
        <Table
          className="mobile-card-table"
          dataSource={filtered}
          columns={columns.map(col => ({
            ...col,
            onCell: () => ({
              'data-label': typeof col.title === 'string' ? col.title : ''
            } as React.HTMLAttributes<HTMLElement>)
          }))}
          rowKey={(r) => `mistake-${r.id}-${r.game_number}`}
          size="small"
          pagination={{
            current: page,
            pageSize: pageSize,
            total: filtered.length,
            onChange: (p, ps) => { setPage(p); if (ps !== pageSize) setPageSize(ps); },
            showSizeChanger: true,
            showTotal: total => `共 ${total} 条`,
          }}
          scroll={{ x: 'max-content', y: isMobile ? undefined : 'calc(max(300px, 100vh - 520px))' }}
          locale={{ emptyText: <Empty description={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span>暂无错题记录</span>
              <span style={{ color: '#8b949e', fontSize: 12 }}>预测正确时不会产生错题记录 ✅</span>
            </div>
          } /> }}
          rowClassName={() => 'row-mistake'}
          style={{ width: '100%' }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title={`错题详情 - 第${selectedMistake?.game_number}局`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[<Button key="close" onClick={() => setDetailModalOpen(false)}>关闭</Button>]}
        width={680}
        style={{ maxWidth: 'calc(100vw - 20px)' }}
      >
        {selectedMistake && (
          <>
            <Descriptions bordered column={isMobile ? 1 : 2} size="small" labelStyle={{ width: isMobile ? 88 : 100, background: '#161b22' }} style={{ marginBottom: 16 }}>
              
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
              title={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icons.Aim /> AI模型分析摘要</span>}
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
            <div className="mobile-section-stack" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <Card
                  size="small"
                  title={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icons.Warning /> 错因分析</span>}
                  styles={{ header: { background: '#2d1318', color: '#ff4d4f' } }}
                >
                  <p style={{ color: '#c9d1d9', lineHeight: 1.8, margin: 0 }}>
                    {selectedMistake.analysis || <span style={{ color: '#555' }}>暂无分析</span>}
                  </p>
                </Card>
              </div>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <Card
                  size="small"
                  title={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icons.Check /> 修正策略</span>}
                  styles={{ header: { background: '#132d1c', color: '#52c41a' } }}
                >
                  <p style={{ color: '#c9d1d9', lineHeight: 1.8, margin: 0 }}>
                    {selectedMistake.correction || <span style={{ color: '#555' }}>暂无修正策略</span>}
                  </p>
                </Card>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default MistakeBookPage;
