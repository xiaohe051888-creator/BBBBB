/**
 * 工作流状态提示栏组件
 */
import React from 'react';
import { Button } from 'antd';
import { ClockIcon, BulbIcon, UploadIcon, ChartIcon, TargetIcon } from '../ui/Icons';

interface WorkflowBarProps {
  hasPendingBet: boolean;
  hasGameData: boolean;
  analysis: { prediction?: string | null; confidence?: number | null; bet_tier?: string | null } | null;
  pendingGameNumber: number | undefined;
  systemGameNumber: number;
  timer: { remaining: number };
  formattedTime: string;
  onOpenReveal: () => void;
}

export const WorkflowBar: React.FC<WorkflowBarProps> = ({
  hasPendingBet, hasGameData, analysis, pendingGameNumber, systemGameNumber, timer, formattedTime, onOpenReveal,
}) => {
  const getIconColor = () => {
    if (hasPendingBet) return '#faad14';
    if (analysis?.prediction && !hasPendingBet) return '#52c41a';
    if (!hasGameData) return '#1890ff';
    return '#8b949e';
  };

  const getIcon = () => {
    if (hasPendingBet) return <ClockIcon />;
    if (analysis?.prediction && !hasPendingBet) return <BulbIcon />;
    if (!hasGameData) return <UploadIcon />;
    return <ChartIcon />;
  };

  const getMainStatus = () => {
    if (hasPendingBet) return `第 ${pendingGameNumber} 局已下注，等待开奖结果`;
    if (analysis?.prediction && !hasPendingBet) return `AI分析完成，推荐下注：${analysis.prediction}`;
    if (!hasGameData) return '系统已就绪，请上传开奖记录';
    return `当前第 ${systemGameNumber} 局，等待下一步操作`;
  };

  const getSubStatus = () => {
    if (hasPendingBet) return '请点击右上角【开奖】按钮输入结果';
    if (analysis?.prediction && !hasPendingBet) return 'AI分析完成，系统自动下注中...';
    if (!hasGameData) return '点击右上角【上传数据】按钮开始';
    return '请根据系统状态进行相应操作';
  };

  const getBackground = () => {
    if (hasPendingBet) return 'linear-gradient(135deg, rgba(250,173,20,0.15), rgba(250,173,20,0.08))';
    if (analysis?.prediction && !hasPendingBet) return 'linear-gradient(135deg, rgba(82,196,26,0.15), rgba(82,196,26,0.08))';
    if (!hasGameData) return 'linear-gradient(135deg, rgba(24,144,255,0.15), rgba(24,144,255,0.08))';
    return 'linear-gradient(135deg, rgba(150,150,150,0.1), rgba(150,150,150,0.05))';
  };

  const getBorderColor = () => {
    if (hasPendingBet) return 'rgba(250,173,20,0.25)';
    if (analysis?.prediction && !hasPendingBet) return 'rgba(82,196,26,0.25)';
    if (!hasGameData) return 'rgba(24,144,255,0.25)';
    return 'rgba(255,255,255,0.1)';
  };

  const iconColor = getIconColor();

  return (
    <div style={{ padding: '10px 20px', background: getBackground(), borderBottom: `1px solid ${getBorderColor()}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 20, color: iconColor }}>{getIcon()}</span>
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: iconColor }}>{getMainStatus()}</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginLeft: 12 }}>{getSubStatus()}</span>
        </div>
      </div>

      {hasPendingBet && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {timer.remaining > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: timer.remaining < 30 ? 'rgba(255,77,79,0.1)' : 'rgba(250,173,20,0.1)', border: `1px solid ${timer.remaining < 30 ? 'rgba(255,77,79,0.3)' : 'rgba(250,173,20,0.3)'}` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={timer.remaining < 30 ? '#ff7875' : '#ffd666'}>
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: timer.remaining < 30 ? '#ff7875' : '#ffd666', fontFamily: 'monospace' }}>{formattedTime}</span>
            </div>
          )}
          <Button type="primary" onClick={onOpenReveal} style={{ background: 'linear-gradient(135deg, #faad14, #f0961a)', border: 'none', fontWeight: 700, fontSize: 14, borderRadius: 8, boxShadow: '0 4px 20px rgba(250,173,20,0.4)' }}>
            <TargetIcon /> 开奖
          </Button>
        </div>
      )}
    </div>
  );
};
