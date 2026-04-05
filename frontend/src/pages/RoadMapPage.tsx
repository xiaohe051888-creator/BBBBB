/**
 * 走势图详情页 - 全屏五路走势图展示 + 原始数据列表
 * 路由：/dashboard/:tableId/roadmap
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Select, Space, Tag, Table, Row, Col,
  Statistic, Segmented, Tooltip, Spin, Empty, message,
} from 'antd';
import {
  ArrowLeftOutlined, ReloadOutlined, FullscreenOutlined,
  DownloadOutlined, InfoCircleOutlined, LineChartOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import * as api from '../services/api';
import FiveRoadChart from '../components/roads/FiveRoadChart';
import { ROAD_COLORS } from '../types/road';

interface RawGameRecord {
  game_number: number;
  result: string;
  result_time: string | null;
  predict_direction: string | null;
  predict_correct: boolean | null;
}

const RoadMapPage: React.FC = () => {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  // 数据
  const [roadData, setRoadData] = useState<api.FiveRoadsResponse | null>(null);
  const [rawData, setRawData] = useState<RawGameRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chart' | 'raw' | 'analysis'>('chart');

  // 筛选
  const [bootNumber, setBootNumber] = useState<number | undefined>();
  const [bootOptions, setBootOptions] = useState<{ label: string; value: number }[]>([]);

  // 统计
  const stats = {
    totalGames: roadData?.total_games || rawData.length,
    bankerCount: rawData.filter(r => r.result === '庄').length,
    playerCount: rawData.filter(r => r.result === '闲').length,
    tieCount: rawData.filter(r => r.result === '和').length,
    accuracy: rawData.filter(r => r.predict_correct === true).length /
      (rawData.filter(r => r.predict_correct !== null).length || 1) * 100,
  };

  // 加载走势图数据
  const loadRoadData = useCallback(async () => {
    if (!tableId) return;
    setLoading(true);
    try {
      const res = await api.getRoadMaps(tableId, bootNumber);
      if (res.data && (res.data as any).roads) {
        setRoadData(res.data as api.FiveRoadsResponse);
      }
    } catch {
      console.log('走势图API暂无数据，使用模拟展示');
      setRoadData(null);
    } finally {
      setLoading(false);
    }
  }, [tableId, bootNumber]);

  // 加载原始数据
  const loadRawData = useCallback(async () => {
    if (!tableId) return;
    try {
      const res = await api.getRoadRawData(tableId, bootNumber);
      if (res.data && (res.data as any).data) {
        setRawData((res.data as any).data);
        // 提取靴号选项
        const boots = new Set<number>();
        (res.data as any).data.forEach((r: RawGameRecord) => {
          // 从结果时间推断或使用固定逻辑
        });
        if ((res.data as any).boot_number) {
          setBootOptions([{ label: `第${(res.data as any).boot_number}靴`, value: (res.data as any).boot_number }]);
        }
      }
    } catch {
      // 使用模拟数据
      generateMockRawData();
    }
  }, [tableId, bootNumber]);

  // 模拟原始数据
  const generateMockRawData = () => {
    const mock: RawGameRecord[] = [];
    const results = ['庄', '闲'];
    for (let i = 1; i <= 50; i++) {
      mock.push({
        game_number: i,
        result: results[Math.floor(Math.random() * 2)],
        result_time: dayjs().subtract(50 - i, 'minute').toISOString(),
        predict_direction: i < 50 ? results[Math.floor(Math.random() * 2)] : null,
        predict_correct: i < 50 ? Math.random() > 0.4 : null,
      });
    }
    setRawData(mock);
  };

  useEffect(() => {
    loadRoadData();
    loadRawData();
  }, [loadRoadData, loadRawData]);

  // 自动刷新（每10秒）
  useEffect(() => {
    const interval = setInterval(() => {
      loadRoadData();
      loadRawData();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadRoadData, loadRawData]);

  // 原始数据表格列
  const rawColumns: ColumnsType<RawGameRecord> = [
    { title: '局号', dataIndex: 'game_number', width: 60, align: 'center' },
    {
      title: '开奖结果',
      dataIndex: 'result',
      width: 80,
      align: 'center',
      render: (v: string) => (
        <Tag
          color={v === '庄' ? '#ff4d4f' : v === '闲' ? '#1890ff' : '#52c41a'}
          style={{ fontWeight: 700, fontSize: 13 }}
        >
          {v}
        </Tag>
      ),
    },
    {
      title: '预测方向',
      dataIndex: 'predict_direction',
      width: 80,
      align: 'center',
      render: (v: string | null) => v ? <Tag color="gold">{v}</Tag> : '-',
    },
    {
      title: '预测正确',
      dataIndex: 'predict_correct',
      width: 80,
      align: 'center',
      render: (v: boolean | null) =>
        v === null ? '-' : v
          ? <Tag color="success">✓ 正确</Tag>
          : <Tag color="error">✗ 错误</Tag>,
    },
    {
      title: '开奖时间',
      dataIndex: 'result_time',
      width: 150,
      render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
  ];

  // 路势分析（从原始数据计算）
  const analyzePattern = () => {
    if (rawData.length < 3) return '数据不足，需要至少3条记录才能分析路势';
    
    const last5 = rawData.slice(-5).map(r => r.result);
    const bankerStreak = [...last5].reverse().findIndex(r => r !== '庄') || 5;
    const playerStreak = [...last5].reverse().findIndex(r => r !== '闲') || 5;

    let analysis = `最近5局结果：${last5.join(' → ')}\n\n`;
    
    if (bankerStreak >= 3) analysis += `⚠️ 庄已连续${bankerStreak}局，注意转闲可能\n`;
    if (playerStreak >= 3) analysis += `⚠️ 闲已连续${playerStreak}局，注意转庄可能\n`;
    
    const ratio = (stats.bankerCount / (stats.totalGames - stats.tieCount) * 100).toFixed(1);
    analysis += `\n📊 本靴庄闲比：庄 ${stats.bankerCount} (${ratio}%) / 闲 ${stats.playerCount} (${(100 - parseFloat(ratio)).toFixed(1)}%)`;
    
    return analysis;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', padding: 16 }}>
      {/* 顶部导航栏 */}
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
            <LineChartOutlined style={{ marginRight: 8 }} />
            五路走势图详情 — {tableId}
          </span>
          <Select
            size="small"
            placeholder="选择靴号"
            value={bootNumber}
            onChange={setBootNumber}
            options={bootOptions}
            style={{ width: 120 }}
            allowClear
          />
        </Space>

        <Space size="middle">
          {/* 快速统计 */}
          <Statistic title="总局数" value={stats.totalGames} styles={{ content: { fontSize: 14, color: '#58a6ff' } }} />
          <Statistic title="庄" value={stats.bankerCount} styles={{ content: { fontSize: 14, color: '#ff4d4f' } }} suffix={`/ ${stats.totalGames ? (stats.bankerCount / stats.totalGames * 100).toFixed(0) : 0}%`} />
          <Statistic title="闲" value={stats.playerCount} styles={{ content: { fontSize: 14, color: '#1890ff' } }} suffix={`/ ${stats.totalGames ? (stats.playerCount / stats.totalGames * 100).toFixed(0) : 0}%`} />
          
          <Segmented
            size="small"
            value={activeTab}
            onChange={(v) => setActiveTab(v as any)}
            options={[
              { label: '📊 走势图', value: 'chart' },
              { label: '📋 原始数据', value: 'raw' },
              { label: '🔍 路势分析', value: 'analysis' },
            ]}
          />
          
          <Button icon={<ReloadOutlined />} size="small" onClick={() => { loadRoadData(); loadRawData(); }}>
            刷新
          </Button>
        </Space>
      </div>

      {/* 主内容区 */}
      <Spin spinning={loading}>
        {activeTab === 'chart' && (
          <Card
            title={<span>🎯 五路走势图（全屏模式）</span>}
            style={{ minHeight: 'calc(100vh - 160px)' }}
          >
            <FiveRoadChart
              data={roadData?.roads ?? null}
              loading={loading}
              useMockData={!roadData}  // 无真实数据时自动使用模拟数据
              mockGameCount={50}
            />
            
            {/* 图例说明 */}
            <div style={{
              display: 'flex',
              gap: 24,
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid #21262d',
              fontSize: 12,
              color: '#8b949e',
            }}>
              <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#ff4d4f', marginRight: 4 }} />庄(Banker)</span>
              <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#1890ff', marginRight: 4 }} />闲(Player)</span>
              <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: '#52c41a', marginRight: 4 }} />和(Tie)</span>
              <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#faad14', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', marginRight: 4 }} />错误标记</span>
              <span><Tooltip title="大路：相同颜色一组最多6个；珠盘路：14列×6行；下三路：红=与上一列相同，蓝=不同"><InfoCircleOutlined /> 规则说明</Tooltip></span>
            </div>
          </Card>
        )}

        {activeTab === 'raw' && (
          <Card title={<span>📋 原始开奖数据</span>} style={{ minHeight: 'calc(100vh - 160px)' }}>
            <Table
              dataSource={rawData}
              columns={rawColumns}
              rowKey="game_number"
              size="small"
              pagination={{
                pageSize: 20,
                showTotal: (total) => `共 ${total} 条记录`,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
              scroll={{ y: 'calc(100vh - 280px)' }}
              locale={{ emptyText: <Empty description="暂无开奖数据" /> }}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <strong>合计</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>
                      <strong>{rawData.length} 条</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} colSpan={3}>
                      <Space>
                        <Tag color="#ff4d4f">庄 {stats.bankerCount}</Tag>
                        <Tag color="#1890ff">闲 {stats.playerCount}</Tag>
                        <Tag color="#52c41a">和 {stats.tieCount}</Tag>
                      </Space>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          </Card>
        )}

        {activeTab === 'analysis' && (
          <Row gutter={[16, 16]} style={{ minHeight: 'calc(100vh - 160px)' }}>
            {/* 路势分析 */}
            <Col span={12}>
              <Card
                title={<span><InfoCircleOutlined style={{ color: '#58a6ff' }} /> 路势分析</span>}
                style={{ height: '100%' }}
              >
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: 13,
                  lineHeight: 1.8,
                  background: '#161b22',
                  padding: 16,
                  borderRadius: 8,
                  color: '#e6edf3',
                  fontFamily: 'monospace',
                }}>
                  {analyzePattern()}
                </pre>
              </Card>
            </Col>

            {/* 统计面板 */}
            <Col span={12}>
              <Card title={<span>📈 数据统计</span>} style={{ marginBottom: 16 }}>
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Statistic title="总局数" value={stats.totalGames} suffix="局" styles={{ content: { color: '#58a6ff' } }} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="庄出现" value={stats.bankerCount} suffix={`(${(stats.bankerCount / Math.max(stats.totalGames - stats.tieCount, 1) * 100).toFixed(1)}%)`} styles={{ content: { color: '#ff4d4f' } }} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="闲出现" value={stats.playerCount} suffix={`(${(stats.playerCount / Math.max(stats.totalGames - stats.tieCount, 1) * 100).toFixed(1)}%)`} styles={{ content: { color: '#1890ff' } }} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="和局" value={stats.tieCount} styles={{ content: { color: '#52c41a' } }} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="预测准确率" value={stats.accuracy.toFixed(1)} suffix="%" styles={{ content: { color: stats.accuracy >= 55 ? '#52c41a' : '#ff4d4f' } }} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="最大连庄" value={calcMaxStreak(rawData, '庄')} styles={{ content: { color: '#ff4d4f' } }} />
                  </Col>
                </Row>
              </Card>

              <Card title={<span>📐 走势图规则速查</span>}>
                <div style={{ fontSize: 13, lineHeight: 2, color: '#8b949e' }}>
                  <p><strong style={{ color: '#ff4d4f' }}>大路规则：</strong></p>
                  <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                    <li>相同颜色结果一组最多6个（纵向排列）</li>
                    <li>颜色变化时必须换列（新开一列）</li>
                    <li>每列第一行前一行有结果时向右对齐</li>
                  </ul>
                  <p style={{ marginTop: 8 }}><strong style={{ color: '#1890ff' }}>珠盘路规则：</strong></p>
                  <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                    <li>固定14列×6行网格布局</li>
                    <li>从左到右、从下到上依次填入</li>
                    <li>每列满6个后自动换到下一列</li>
                  </ul>
                  <p style={{ marginTop: 8 }}><strong style={{ color: '#faad14' }}>下三路规则：</strong></p>
                  <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                    <li>颜色不代表庄闲！红=与前一同，蓝=不同</li>
                    <li>基于大路的列间关系衍生计算</li>
                    <li>大眼仔：比较第1列与第3列起</li>
                    <li>小路：比较第2列与第4列起</li>
                    <li>螳螂路：比较第3列与第5列起</li>
                  </ul>
                </div>
              </Card>
            </Col>
          </Row>
        )}
      </Spin>
    </div>
  );
};

// 计算最大连串
function calcMaxStreak(data: RawGameRecord[], target: string): number {
  let maxStreak = 0;
  let currentStreak = 0;
  for (const r of data) {
    if (r.result === target) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  return maxStreak;
}

export default RoadMapPage;
