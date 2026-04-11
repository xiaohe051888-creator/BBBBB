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
  tableId?: string;
  compact?: boolean;
}

export const LearningStatusPanel: React.FC<LearningStatusPanelProps> = ({
  microLearning,
  deepLearning,
  systemStatus,
  tableId,
  compact,
}) => {
  // 避免未使用变量警告
  void tableId;
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
    <Space direction="vertical" style={{ width: '100%' }}>
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
          <Space direction="vertical" style={{ width: '100%' }}>
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
                message="深度学习完成！可以上传新靴数据了"
                type="success"
                showIcon
              />
            )}
            
            {deepLearning.status === '失败' && deepLearning.error && (
              <Alert
                message={`学习失败: ${deepLearning.error}`}
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
              <SyncOutlined spin />
              <Text strong>微学习中</Text>
            </Space>
          }
          style={{ borderLeft: '4px solid #1890ff' }}
        >
          <Text type="secondary">
            正在分析第{microLearning.game_number}局的错误模式，提升下一局预测准确率...
          </Text>
        </Card>
      )}

      {/* 微学习完成提示 */}
      {microLearning && microLearning.status === '完成' && (
        <Card
          size="small"
          style={{ borderLeft: '4px solid #52c41a', backgroundColor: '#f6ffed' }}
        >
          <Space>
            {getMicroLearningIcon(microLearning.status)}
            <Text>
              第{microLearning.game_number}局微学习完成：
              预测{microLearning.prediction}，实际{microLearning.actual}，
              {microLearning.is_correct ? (
                <span style={{ color: '#52c41a' }}>正确✓</span>
              ) : (
                <span style={{ color: '#ff4d4f' }}>错误✗</span>
              )}
            </Text>
          </Space>
        </Card>
      )}
    </Space>
  );
};

export default LearningStatusPanel;
