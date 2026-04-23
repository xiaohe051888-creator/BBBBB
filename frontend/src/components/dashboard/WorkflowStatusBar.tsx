/**
 * WorkflowStatusBar - 工作流状态提示栏组件
 *
 * 包含: 状态提示、倒计时、开奖按钮
 */
import React from 'react';
import { Button } from 'antd';
import { useWaitTimer } from '../../hooks/useWaitTimer';
import {
  ClockIcon,
  BulbIcon,
  UploadIcon,
  ChartIcon,
  TargetIcon,
} from '../icons';

interface WorkflowStatusBarProps {
  hasPendingBet: boolean;
  hasGameData: boolean;
  analysis: {
    prediction?: string | null;
    confidence?: number;
  } | null;
  systemState: {
    game_number?: number;
    pending_bet?: {
      game_number: number;
    } | null;
    next_game_number?: number;
  } | null;
  onOpenReveal: () => void;
}

export const WorkflowStatusBar: React.FC<WorkflowStatusBarProps> = ({
  hasPendingBet,
  hasGameData,
  analysis,
  systemState,
  onOpenReveal,
}) => {
  const { seconds: waitSeconds, formattedTime: waitFormattedTime } = useWaitTimer({ enabled: hasPendingBet });
  const pendingGameNumber = systemState?.pending_bet?.game_number ?? systemState?.next_game_number;

  const getStatusConfig = () => {
    if (hasPendingBet) {
      return {
        icon: <ClockIcon />,
        iconColor: '#faad14',
        title: `第 ${pendingGameNumber} 局已下注，等待开奖结果`,
        subtitle: '请点击右上角【开奖】按钮输入结果',
        bgGradient: 'linear-gradient(135deg, rgba(250,173,20,0.15), rgba(250,173,20,0.08))',
        borderColor: 'rgba(250,173,20,0.25)',
      };
    }
    if (analysis?.prediction && !hasPendingBet) {
      return {
        icon: <BulbIcon />,
        iconColor: '#52c41a',
        title: `AI分析完成，推荐下注：${analysis.prediction}`,
        subtitle: 'AI分析完成，系统自动下注中...',
        bgGradient: 'linear-gradient(135deg, rgba(82,196,26,0.15), rgba(82,196,26,0.08))',
        borderColor: 'rgba(82,196,26,0.25)',
      };
    }
    if (!hasGameData) {
      return {
        icon: <UploadIcon />,
        iconColor: '#1890ff',
        title: '系统已就绪，请上传开奖记录',
        subtitle: '点击右上角【上传数据】按钮开始',
        bgGradient: 'linear-gradient(135deg, rgba(24,144,255,0.15), rgba(24,144,255,0.08))',
        borderColor: 'rgba(24,144,255,0.25)',
      };
    }
    return {
      icon: <ChartIcon />,
      iconColor: '#8b949e',
      title: `当前第 ${systemState?.game_number || 0} 局，等待下一步操作`,
      subtitle: '请根据系统状态进行相应操作',
      bgGradient: 'linear-gradient(135deg, rgba(150,150,150,0.1), rgba(150,150,150,0.05))',
      borderColor: 'rgba(255,255,255,0.1)',
    };
  };

  const config = getStatusConfig();

  return (
    <div style={{
      padding: '10px 20px',
      background: config.bgGradient,
      borderBottom: `1px solid ${config.borderColor}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 20, color: config.iconColor }}>
          {config.icon}
        </span>
        <div>
          <span style={{
            fontSize: 14,
            fontWeight: 700,
            color: hasPendingBet
              ? '#faad14'
              : analysis?.prediction && !hasPendingBet
                ? '#52c41a'
                : !hasGameData
                  ? '#1890ff'
                  : '#e6edf3'
          }}>
            {config.title}
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginLeft: 12 }}>
            {config.subtitle}
          </span>
        </div>
      </div>

      {/* 等待开奖时显示开奖按钮 */}
      {hasPendingBet && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 工作流倒计时 */}
          {waitSeconds >= 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              background: waitSeconds > 30 ? 'rgba(255,77,79,0.1)' : 'rgba(250,173,20,0.1)',
              border: `1px solid ${waitSeconds > 30 ? 'rgba(255,77,79,0.3)' : 'rgba(250,173,20,0.3)'}`,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={waitSeconds > 30 ? '#ff7875' : '#ffd666'}>
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
              </svg>
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: waitSeconds > 30 ? '#ff7875' : '#ffd666',
                fontFamily: 'monospace',
              }}>
                {waitFormattedTime}
              </span>
            </div>
          )}
          <Button
            type="primary"
            size="middle"
            onClick={onOpenReveal}
            style={{
              background: 'linear-gradient(135deg, #faad14, #f0961a)',
              border: 'none',
              fontWeight: 700,
              fontSize: 14,
              borderRadius: 8,
              boxShadow: '0 4px 20px rgba(250,173,20,0.4)',
            }}
          >
            <TargetIcon width={16} height={16} /> 开奖
          </Button>
        </div>
      )}
    </div>
  );
};

export default WorkflowStatusBar;
