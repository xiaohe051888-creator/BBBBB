/**
 * WorkflowStatusBar - 工作流状态提示栏组件
 *
 * 包含: 状态提示、倒计时、开奖按钮
 */
import React from 'react';
import { Button } from 'antd';

import { useWaitTimer } from '../../hooks/useWaitTimer';
import {
  ClockCircleOutlined as ClockIcon,
  BulbOutlined as BulbIcon,
  LineChartOutlined as ChartIcon,
  AimOutlined as TargetIcon,
} from '@ant-design/icons';

interface WorkflowStatusBarProps {
  hasPendingBet: boolean;
  hasGameData: boolean;
  analysis: {
    prediction?: string | null;
    confidence?: number;
  } | null;
  systemState: {
    status?: string;
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

  if (systemState?.status === '余额不足') {
    return (
      <div className="status-bar warning" style={{ background: 'rgba(250, 173, 20, 0.1)', border: '1px solid #faad14' }}>
        <div className="status-icon-wrapper" style={{ background: '#faad14', color: '#141414' }}>
          <ClockIcon />
        </div>
        <div className="status-content">
          <div className="status-title" style={{ color: '#faad14' }}>余额不足，系统已挂起</div>
          <div className="status-subtitle" style={{ color: 'rgba(255,255,255,0.6)' }}>
            当前系统余额不足以下一局预测，预测与开奖流程已暂停。请前往【管理员控制台】充值。
          </div>
        </div>
      </div>
    );
  }

  const getStatusConfig = () => {
    if (hasPendingBet) {
      return {
        icon: <ClockIcon />,
        iconColor: '#faad14',
        title: `第 ${pendingGameNumber} 局已下注，等待开奖结果`,
        subtitle: '请点击右侧【🎯 开奖】按钮录入本局结果',
        bgGradient: 'linear-gradient(135deg, rgba(250,173,20,0.15), rgba(250,173,20,0.08))',
        borderColor: 'rgba(250,173,20,0.25)',
      };
    }
    if (analysis?.prediction && !hasPendingBet) {
      const isWait = analysis.prediction === '观望';
      return {
        icon: <BulbIcon />,
        iconColor: isWait ? '#1890ff' : '#52c41a',
        title: `AI分析完成，推荐方向：${analysis.prediction}`,
        subtitle: isWait ? '建议本局观望，请等待开奖结果' : '系统自动下注中...',
        bgGradient: isWait 
          ? 'linear-gradient(135deg, rgba(24,144,255,0.15), rgba(24,144,255,0.08))'
          : 'linear-gradient(135deg, rgba(82,196,26,0.15), rgba(82,196,26,0.08))',
        borderColor: isWait ? 'rgba(24,144,255,0.25)' : 'rgba(82,196,26,0.25)',
      };
    }

    if (systemState?.status === '分析中' && !hasPendingBet) {
      return {
        icon: <BulbIcon />,
        iconColor: '#1890ff',
        title: `AI正在深度分析中...`,
        subtitle: '正在结合五路走势与历史血迹图进行三模型预测，请稍候',
        bgGradient: 'linear-gradient(135deg, rgba(24,144,255,0.15), rgba(24,144,255,0.08))',
        borderColor: 'rgba(24,144,255,0.25)',
      };
    }
    if (!hasGameData) {
      return {
        icon: <TargetIcon />,
        iconColor: '#1890ff',
        title: '系统无数据，请先上传本靴历史数据',
        subtitle: '请前往【前往上传数据】页面完成录入',
        bgGradient: 'linear-gradient(135deg, rgba(24,144,255,0.15), rgba(24,144,255,0.08))',
        borderColor: 'rgba(24,144,255,0.25)',
      };
    }

    if ((systemState?.game_number || 0) >= 72 || (systemState?.next_game_number || 0) > 72) {
      return {
        icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>,
        iconColor: '#ff4d4f',
        title: `本靴已满（共72局），请结束本靴`,
        subtitle: '请点击右侧【结束本靴】按钮，进行深度学习并开始新靴',
        bgGradient: 'linear-gradient(135deg, rgba(255,77,79,0.15), rgba(255,77,79,0.08))',
        borderColor: 'rgba(255,77,79,0.25)',
      };
    }
    return {
      icon: <ChartIcon />,
      iconColor: '#8b949e',
      title: `请录入第 ${systemState?.next_game_number || (systemState?.game_number || 0) + 1} 局开奖结果`,
      subtitle: '分析完成，系统已自动下注。请点击右侧【🎯 开奖】按钮录入本局结果',
      bgGradient: 'linear-gradient(135deg, rgba(150,150,150,0.1), rgba(150,150,150,0.05))',
      borderColor: 'rgba(255,255,255,0.1)',
    };
  };

  const config = getStatusConfig();

  return (
    <div className="status-bar" style={{
      padding: '10px 20px',
      background: config.bgGradient,
      borderBottom: `1px solid ${config.borderColor}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap', // 添加此属性以修复在手机端按钮溢出屏幕的问题
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
          {config.subtitle}
        </span>
      </div>

      {/* 等待开奖或等待第一局录入时显示开奖按钮 */}
      {(hasPendingBet && systemState?.status === '等待开奖') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* 工作流倒计时 */}
          {hasPendingBet && waitSeconds >= 0 && (
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
            aria-label="开奖"
          >
            <TargetIcon width={16} height={16} /> 开奖
          </Button>
        </div>
      )}
    </div>
  );
};

export default WorkflowStatusBar;
