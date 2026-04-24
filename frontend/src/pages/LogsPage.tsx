/**
 * 实盘日志页面 - 实时运行日志
 * 路由：/dashboard/logs
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Space, Select, Tag } from 'antd';
import { useLogsQuery } from '../hooks';
import LogTable from '../components/tables/LogTable';
import { useQueryClient } from '@tanstack/react-query';

// 图标组件
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
  File: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/>
    </svg>
  ),
};

const CATEGORIES = [
  { label: '全部', value: '' },
  { label: 'AI事件', value: 'AI事件' },
  { label: '资金事件', value: '资金事件' },
  { label: '系统异常', value: '系统异常' },
  { label: '系统通知', value: '系统通知' },
];

const LogsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<string>('');

  // 获取日志数据（乐观UI策略）
  const { data, isLoading } = useLogsQuery({ 
    category: category || undefined, 
    pageSize: 100 
  });
  const logs = data?.logs || [];

  // 手动刷新
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['logs'] });
  };

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* 顶部导航与操作栏 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 16
      }}>
        <Space size="middle" align="center">
          <Button 
            icon={<Icons.Back />} 
            onClick={() => navigate('/dashboard')}
            style={{ borderRadius: 8 }}
          >
            返回看板
          </Button>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.File /> 实盘日志
            <Tag color="blue" style={{ borderRadius: 12, marginLeft: 8 }}>{logs.length} 条记录</Tag>
          </h2>
        </Space>
        <Space>
          <Select
            value={category}
            onChange={setCategory}
            style={{ width: 140 }}
            options={CATEGORIES}
            placeholder="筛选日志分类"
          />
          <Button 
            type="primary" 
            ghost
            icon={<Icons.Refresh />} 
            onClick={handleRefresh}
            style={{ borderRadius: 8 }}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* 数据表格 - 自适应布局 */}
      <Card 
        bodyStyle={{ padding: 0 }} 
        style={{ 
          borderRadius: 12, 
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          border: '1px solid rgba(0,0,0,0.05)'
        }}
      >
        <LogTable data={logs} loading={isLoading} scrollY={800} />
      </Card>
    </div>
  );
};

export default LogsPage;
