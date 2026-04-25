/**
 * 学习状态面板 - 显示微学习和深度学习状态
 */
import React from 'react';
import { Card, Progress, Tag, Typography, Space, Alert } from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { RobotIcon } from './ui/Icons';

const { Text, Title } = Typography;

interface MicroLearningStatus {
  game_number?: number;
  status: '进行中' | '完成' | '失败' | '跳过';
  prediction?: string;
  actual?: string;
  is_correct?: boolean;
  reason?: string;
  error?: string;
  message?: string;
}

interface DeepLearningStatus {
  boot_number?: number;
  status: '启动中' | '数据准备' | 'AI分析' | '生成版本' | '完成' | '失败';
  progress: number;
  message: string;
  start_time?: string;
  error?: string;
}

interface LearningStatusPanelProps {
  microLearning?: MicroLearningStatus | null;
  deepLearning?: DeepLearningStatus | null;
  systemStatus?: string;
  
  compact?: boolean;
}

export const LearningStatusPanel: React.FC<LearningStatusPanelProps> = ({
  microLearning,
  deepLearning,
  systemStatus,

  compact,
}) => {
  // 避免未使用变量警告
  
  void compact;
  // 是否正在深度学习中
  const isDeepLearning = systemStatus === '深度学习中' || deepLearning?.status === 'AI分析' || deepLearning?.status === '数据准备' || deepLearning?.status === '生成版本';

  // 深度学习状态颜色
  const getDeepLearningColor = (status?: string) => {
    switch (status) {
      case '完成': return 'success';
      case '失败': return 'error';
      case 'AI分析': return 'processing';
      case '生成版本': return 'warning';
      default: return 'default';
    }
  };

  // 微学习状态图标
  const getMicroLearningIcon = (status?: string) => {
    switch (status) {
      case '完成': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case '失败': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case '跳过': return <SyncOutlined style={{ color: '#faad14' }} />;
      default: return <LoadingOutlined style={{ color: '#1890ff' }} spin />;
    }
  };

  // 如果没有学习状态，不显示
  if (!isDeepLearning && !microLearning) {
    return null;
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {/* 深度学习状态 */}
      {isDeepLearning && deepLearning && (
        <Card
          size="small"
          title={
            <Space>
              <RobotIcon />
              <Title level={5} style={{ margin: 0 }}>深度学习进行中</Title>
              <Tag color={getDeepLearningColor(deepLearning.status)}>
                {deepLearning.status}
              </Tag>
            </Space>
          }
          style={{ borderLeft: '4px solid #722ed1' }}
        >
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Text type="secondary">
              第{deepLearning.boot_number}靴数据学习，生成新版本模型...
            </Text>
            
            <Progress
              percent={deepLearning.progress}
              status={deepLearning.status === '失败' ? 'exception' : 'active'}
              strokeColor={deepLearning.status === '完成' ? '#52c41a' : '#722ed1'}
            />
            
            <Text>{deepLearning.message}</Text>
            
            {deepLearning.status === '完成' && (
              <Alert
                title="深度学习完成！可以上传新靴数据了"
                type="success"
                showIcon
              />
            )}
            
            {deepLearning.status === '失败' && deepLearning.error && (
              <Alert
                title={`学习失败: ${deepLearning.error}`}
                type="error"
                showIcon
              />
            )}
          </Space>
        </Card>
      )}

      {/* 微学习状态 */}
      {microLearning && microLearning.status === '进行中' && (
        <Card
          size="small"
          title={
            <Space>
              <SyncOutlined spin style={{ color: '#1890ff' }} />
              <Text strong style={{ color: '#1890ff' }}>实时学习中</Text>
            </Space>
          }
          style={{ 
            borderLeft: '4px solid #1890ff', 
            background: 'rgba(24,144,255,0.05)',
            boxShadow: '0 0 10px rgba(24,144,255,0.15) inset',
            animation: 'pulse-glow 2s infinite'
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
            {microLearning.message || `综合模型正在根据第${microLearning.game_number}局现有走势图进行深度微学习与策略进化，以提升下局准确率...`}
          </Text>
        </Card>
      )}

      {/* 微学习完成提示 */}
      {microLearning && microLearning.status === '完成' && (
        <Card
          size="small"
          style={{ borderLeft: '4px solid #52c41a', background: 'rgba(82,196,26,0.1)' }}
        >
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <Text style={{ color: '#52c41a' }}>
              第{microLearning.game_number}局实时学习完成，已更新最新策略模型
            </Text>
          </Space>
        </Card>
      )}
    </Space>
  );
};

export default LearningStatusPanel;
