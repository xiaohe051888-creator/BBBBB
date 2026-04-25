/**
 * 走势图详情页 - 全屏五路走势图展示 + 原始数据列表
 * 路由：/dashboard/roadmap
 * 
 * 优化：使用React Query + 乐观UI策略，页面切换无加载转圈
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Select, Space, Tag, Table,
  Statistic, Tooltip, Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useRoadsQuery, useGamesQuery } from '../hooks';
import FiveRoadChart from '../components/roads/FiveRoadChart';
import { useQueryClient } from '@tanstack/react-query';

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
  Chart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
    </svg>
  ),
  Target: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3-8c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/>
    </svg>
  ),
  File: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </svg>
  ),
  Info: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </svg>
  ),
  Trend: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
    </svg>
  ),
  Ruler: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 10H3V8h2v4h2V8h2v4h2V8h2v4h2V8h2v4h2V8h2v8z"/>
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

interface RawGameRecord {
  game_number: number;
  result: string;
  result_time: string | null;
  predict_direction: string | null;
  predict_correct: boolean | null;
}

const RoadMapPage: React.FC = () => {
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 标签页状态
  const [activeTab, setActiveTab] = useState<'chart' | 'raw' | 'analysis'>('chart');

  // 靴号筛选
  const [bootNumber, setBootNumber] = useState<number | undefined>();

  // React Query获取五路数据（乐观UI：立即显示缓存数据）
  const { data: roadData } = useRoadsQuery({});

  // React Query获取游戏记录（用于原始数据表格）
  const { data: gamesData } = useGamesQuery({});

  // 使用useMemo缓存games，避免useMemo依赖变化
  const games = useMemo(() => gamesData?.games || [], [gamesData]);

  // 转换为RawGameRecord格式
  const rawData: RawGameRecord[] = useMemo(() => {
    return games.map(g => ({
      game_number: g.game_number,
      result: g.result,
      result_time: g.result_time,
      predict_direction: g.predict_direction,
      predict_correct: g.predict_correct,
    }));
  }, [games]);

  // 靴号选项
  const bootOptions = useMemo(() => {
    const bootSet = new Set(games.map(g => {
      // 从game_number推断靴号（每靴66局）
      return Math.floor((g.game_number - 1) / 66) + 1;
    }));
    return Array.from(bootSet).sort((a, b) => a - b).map(boot => ({
      label: `第${boot}靴`,
      value: boot,
    }));
  }, [games]);

  // 手动刷新
  const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['roads'] });
    queryClient.invalidateQueries({ queryKey: ['games'] });
  };

  // 统计（彻底屏蔽一切非庄闲和的脏数据和占位符）
  const stats = useMemo(() => {
    const validGames = games.filter(r => ['庄', '闲', '和'].includes(r.result));
    const bankerCount = validGames.filter(r => r.result === '庄').length;
    const playerCount = validGames.filter(r => r.result === '闲').length;
    const tieCount = validGames.filter(r => r.result === '和').length;
    // 强制使用三者之和作为总有效局数
    const trueTotalGames = bankerCount + playerCount + tieCount;

    return {
      totalGames: trueTotalGames,
      bankerCount,
      playerCount,
      tieCount,
      accuracy: validGames.filter(r => r.predict_correct === true).length /
        (validGames.filter(r => r.predict_correct !== null).length || 1) * 100,
    };
  }, [games]);

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
          ? <Tag color="success"><Icons.Success /> 正确</Tag>
          : <Tag color="error"><Icons.Error /> 错误</Tag>,
    },
    {
      title: '开奖时间',
      dataIndex: 'result_time',
      width: 150,
      render: (v: string | null) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
  ];

  // 路势分析（从原始数据计算）
  const analyzePattern = useMemo(() => {
    if (rawData.length < 3) return '数据不足，需要至少3条记录才能分析路势';
    
    const last5 = rawData.slice(-5).map(r => r.result);
    const bankerStreak = [...last5].reverse().findIndex(r => r !== '庄') || 5;
    const playerStreak = [...last5].reverse().findIndex(r => r !== '闲') || 5;

    let analysis = `最近5局结果：${last5.join(' → ')}\n\n`;
    
    if (bankerStreak >= 3) analysis += `庄已连续${bankerStreak}局，注意转闲可能\n`;
    if (playerStreak >= 3) analysis += `闲已连续${playerStreak}局，注意转庄可能\n`;
    
    const ratio = (stats.bankerCount / (stats.totalGames - stats.tieCount) * 100).toFixed(1);
    analysis += `\n本靴庄闲比：庄 ${stats.bankerCount} (${ratio}%) / 闲 ${stats.playerCount} (${(100 - parseFloat(ratio)).toFixed(1)}%)`;
    
    return analysis;
  }, [rawData, stats]);

  return (
    <div className="page-wrapper">
      {/* 顶部导航栏 */}
      <div className="page-nav-bar">
        <div className="page-nav-left">
          <Button icon={<Icons.Back />} onClick={() => navigate("/dashboard")}>
            返回
          </Button>
          <span className="page-nav-title" style={{ display: 'flex', alignItems: 'center' }}>
            <Icons.Chart />
            <span style={{ marginLeft: 8 }}>五路走势图</span>
          </span>
        </div>

        <div className="page-nav-right">
          <Select
            size="small"
            value={activeTab}
            onChange={(v) => setActiveTab(v as 'chart' | 'raw' | 'analysis')}
            options={[
              { label: '走势图', value: 'chart' },
              { label: '数据', value: 'raw' },
              { label: '分析', value: 'analysis' },
            ]}
            style={{ width: 120 }}
          />
          <Button 
            icon={<Icons.Refresh />} 
            size="small" 
            onClick={handleRefresh}
          >
            刷新
          </Button>
        </div>
      </div>

      {/* 主内容区 - 乐观UI：无Spin包裹，数据立即显示 */}
      {activeTab === 'chart' && (
        <div style={{
          minHeight: 'calc(100vh - 140px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d1117',
          borderRadius: '12px',
          border: '1px solid #30363d',
          overflow: 'auto',
        }}>
          {/* 标题栏 */}
          <div style={{
            padding: '12px 16px',
            background: 'linear-gradient(90deg, #161b22 0%, #0d1117 100%)',
            borderBottom: '1px solid #30363d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icons.Target />
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#e6edf3' }}>
                五路走势图
              </span>
              <span style={{ fontSize: '12px', color: '#8b949e' }}>澳门标准布局</span>
            </div>
            
            {/* 图例说明 */}
            <div style={{
              display: 'flex',
              gap: '16px',
              fontSize: '12px',
              color: '#8b949e',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff4d4f', boxShadow: '0 0 8px #ff4d4f' }} />
                <span style={{ fontSize: 13, color: '#ff4d4f', fontWeight: 600 }}>庄 {stats.bankerCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1890ff', boxShadow: '0 0 8px #1890ff' }} />
                <span style={{ fontSize: 13, color: '#1890ff', fontWeight: 600 }}>闲 {stats.playerCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#52c41a', boxShadow: '0 0 8px #52c41a' }} />
                <span style={{ fontSize: 13, color: '#52c41a', fontWeight: 600 }}>和 {stats.tieCount}</span>
              </div>
              <Tooltip title="大路：相同颜色一组最多6个；珠盘路：14列×6行；下三路：红=与前一同，蓝=不同">
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'help' }}>
                  <Icons.Info />
                  规则
                </span>
              </Tooltip>
            </div>
          </div>
          
          {/* 五路图区域 */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <FiveRoadChart data={roadData?.roads ?? null} />
          </div>
        </div>
      )}

      {activeTab === 'raw' && (
        <Card title={<span><Icons.File /> 原始开奖数据</span>} style={{ minHeight: 'calc(100vh - 160px)' }}>
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
            scroll={{ x: 600, y: 'calc(100vh - 280px)' }}
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
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', minHeight: 'calc(100vh - 160px)' }}>
          {/* 路势分析 */}
          <div className="roadmap-analysis-col" style={{ flex: '1 1 400px' }}>
            <Card
              title={<span><Icons.Info /> 路势分析</span>}
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
                {analyzePattern}
              </pre>
            </Card>
          </div>

          {/* 统计面板 */}
          <div className="roadmap-analysis-col" style={{ flex: '1 1 400px' }}>
            <Card title={<span><Icons.Trend /> 数据统计</span>} style={{ marginBottom: 16 }}>
              <div className="stats-grid">
                <Statistic title="总局数" value={stats.totalGames} suffix="局" styles={{ content: { color: '#58a6ff' } }} />
                <Statistic title="庄出现" value={stats.bankerCount} suffix={`(${(stats.bankerCount / Math.max(stats.totalGames - stats.tieCount, 1) * 100).toFixed(1)}%)`} styles={{ content: { color: '#ff4d4f' } }} />
                <Statistic title="闲出现" value={stats.playerCount} suffix={`(${(stats.playerCount / Math.max(stats.totalGames - stats.tieCount, 1) * 100).toFixed(1)}%)`} styles={{ content: { color: '#1890ff' } }} />
                <Statistic title="和局" value={stats.tieCount} styles={{ content: { color: '#52c41a' } }} />
                <Statistic title="预测准确率" value={stats.accuracy.toFixed(1)} suffix="%" styles={{ content: { color: stats.accuracy >= 55 ? '#52c41a' : '#ff4d4f' } }} />
                <Statistic title="最大连庄" value={calcMaxStreak(rawData, '庄')} styles={{ content: { color: '#ff4d4f' } }} />
              </div>
            </Card>

            <Card title={<span><Icons.Ruler /> 走势图规则速查</span>}>
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
          </div>
        </div>
      )}
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
