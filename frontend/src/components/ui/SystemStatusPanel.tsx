/**
 * 系统实时状态面板
 * 
 * 在前端直观展示：
 * 1. WebSocket连接状态（在线/断线/重连中/延迟ms）
 * 2. 后端服务状态（在线/离线/延迟ms）
 * 3. AI三模型配置状态（已配置/未配置API Key）
 * 4. 活跃问题告警（可展开详情）
 * 
 * 有问题时会醒目展示，正常时折叠为一个小状态圆点
 */
import React, { useState } from 'react';
import { Tooltip, Badge, Tag, Space } from 'antd';
import type { SystemDiagnostics, SystemIssue, WsStatus, ServiceStatus } from '../../hooks/useSystemDiagnostics';

// ====== 图标 ======
const WsIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
  </svg>
);

const BackendIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
  </svg>
);

const AIIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2c-4.97 0-9 4.03-9 9 0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11c0-4.97-4.03-9-9-9zm0 2c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.3c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
);

// ====== 状态颜色工具 ======
const wsColor = (s: WsStatus): string => {
  if (s === 'connected') return '#52c41a';
  if (s === 'connecting' || s === 'reconnecting') return '#faad14';
  return '#ff4d4f';
};

const wsLabel = (s: WsStatus): string => {
  if (s === 'connected') return '已连接';
  if (s === 'connecting') return '连接中...';
  if (s === 'reconnecting') return '重连中...';
  return '已断线';
};

const backendColor = (s: ServiceStatus): string => {
  if (s === 'online') return '#52c41a';
  if (s === 'degraded') return '#faad14';
  if (s === 'offline') return '#ff4d4f';
  return '#8b949e';
};

const backendLabel = (s: ServiceStatus, latency: number | null): string => {
  if (s === 'online') return latency !== null ? `${latency}ms` : '在线';
  if (s === 'degraded') return `缓慢 ${latency ?? '--'}ms`;
  if (s === 'offline') return '离线';
  return '检测中...';
};

const issueColor = (level: SystemIssue['level']): string => {
  if (level === 'critical') return '#ff4d4f';
  if (level === 'warning') return '#faad14';
  return '#1890ff';
};

const healthColor = (h: SystemDiagnostics['overallHealth']): string => {
  if (h === 'healthy') return '#52c41a';
  if (h === 'warning') return '#faad14';
  if (h === 'critical') return '#ff4d4f';
  return '#8b949e';
};

const healthLabel = (h: SystemDiagnostics['overallHealth']): string => {
  if (h === 'healthy') return '系统正常';
  if (h === 'warning') return '有警告';
  if (h === 'critical') return '有严重问题';
  return '检测中';
};

// ====== 组件 Props ======
interface SystemStatusPanelProps {
  diagnostics: SystemDiagnostics;
  onDismissIssue?: (id: string) => void;
  onRetryConnection?: () => void;
  /** 紧凑模式：只显示状态指示点，悬停展开详情 */
  compact?: boolean;
}

/**
 * 系统状态面板 - 展示实时系统健康状态
 */
export const SystemStatusPanel: React.FC<SystemStatusPanelProps> = ({
  diagnostics,
  onDismissIssue,
  onRetryConnection,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showAllIssues, setShowAllIssues] = useState(false);

  const {
    wsStatus, wsLatency, wsReconnectCount,
    backendStatus, backendLatency,
    aiModels, aiAllOk,
    activeIssues, criticalIssueCount,
    overallHealth,
  } = diagnostics;

  const hasIssues = activeIssues.length > 0;

  // ====== 紧凑模式：只显示一个状态点+Badge ======
  if (compact) {
    const color = healthColor(overallHealth);
    const label = healthLabel(overallHealth);
    const pulse = overallHealth === 'critical' || overallHealth === 'warning';

    return (
      <Tooltip
        title={<StatusTooltip diagnostics={diagnostics} onRetry={onRetryConnection} />}
        trigger="click"
        styles={{
          root: { maxWidth: 360 },
          container: {
            background: '#161b22',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: 12,
          },
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            padding: '4px 10px',
            borderRadius: 20,
            background: `rgba(${color === '#52c41a' ? '82,196,26' : color === '#faad14' ? '250,173,20' : '255,77,79'}, 0.08)`,
            border: `1px solid ${color}30`,
            transition: 'all 0.2s',
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: color,
              flexShrink: 0,
              animation: pulse ? 'pulse-glow 1.5s infinite' : undefined,
            }}
          />
          <span style={{ fontSize: 11, color, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {label}
          </span>
          {criticalIssueCount > 0 && (
            <Badge count={criticalIssueCount} size="small" style={{ backgroundColor: '#ff4d4f' }} />
          )}
        </div>
      </Tooltip>
    );
  }

  // ====== 完整模式 ======
  return (
    <div style={{
      background: 'rgba(22,27,34,0.95)',
      border: `1px solid ${hasIssues ? '#ff4d4f40' : '#30363d'}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* 头部 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          cursor: 'pointer',
          borderBottom: expanded ? '1px solid rgba(48,54,61,0.6)' : 'none',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: healthColor(overallHealth),
            animation: (overallHealth === 'critical' || overallHealth === 'warning') ? 'pulse-glow 1.5s infinite' : undefined,
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>系统状态</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 快速状态徽章 */}
          <Space size={4}>
            <Tooltip title={`WebSocket: ${wsLabel(wsStatus)}`}>
              <span style={{ color: wsColor(wsStatus), fontSize: 12 }}><WsIcon /></span>
            </Tooltip>
            <Tooltip title={`后端: ${backendLabel(backendStatus, backendLatency)}`}>
              <span style={{ color: backendColor(backendStatus), fontSize: 12 }}><BackendIcon /></span>
            </Tooltip>
            <Tooltip title={aiAllOk ? 'AI三模型：全部就绪' : 'AI三模型：部分未配置'}>
              <span style={{ color: aiAllOk ? '#52c41a' : '#faad14', fontSize: 12 }}><AIIcon /></span>
            </Tooltip>
          </Space>

          {criticalIssueCount > 0 && (
            <Badge count={criticalIssueCount} style={{ backgroundColor: '#ff4d4f' }} size="small" />
          )}
          <span style={{ color: '#8b949e', fontSize: 10 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* WebSocket状态行 */}
          <StatusRow
            icon={<WsIcon />}
            label="实时推送"
            color={wsColor(wsStatus)}
            value={wsLabel(wsStatus)}
            extra={wsLatency !== null ? `延迟${wsLatency}ms` : undefined}
            subInfo={wsReconnectCount > 0 ? `已重连${wsReconnectCount}次` : undefined}
            onAction={wsStatus !== 'connected' ? { label: '重连', onClick: onRetryConnection } : undefined}
          />

          {/* 后端状态行 */}
          <StatusRow
            icon={<BackendIcon />}
            label="后端服务"
            color={backendColor(backendStatus)}
            value={backendStatus === 'offline' ? '离线 ⚠' : backendLabel(backendStatus, backendLatency)}
            subInfo={backendStatus === 'offline' ? '请确认 python backend/main.py 已启动（端口8000）' : undefined}
            onAction={backendStatus === 'offline' ? { label: '重试', onClick: onRetryConnection } : undefined}
          />

          {/* AI模型状态 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#8b949e', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AIIcon /> AI三模型
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {aiModels.map(model => (
                <Tooltip
                  key={model.key}
                  title={model.status === 'unconfigured' ? model.message : `${model.name} 正常`}
                >
                  <Tag
                    style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 8,
                      cursor: 'default',
                      background: model.status === 'ok'
                        ? 'rgba(82,196,26,0.1)'
                        : model.status === 'unconfigured'
                          ? 'rgba(255,77,79,0.1)'
                          : 'rgba(139,148,158,0.1)',
                      borderColor: model.status === 'ok'
                        ? 'rgba(82,196,26,0.3)'
                        : model.status === 'unconfigured'
                          ? 'rgba(255,77,79,0.3)'
                          : 'rgba(139,148,158,0.2)',
                      color: model.status === 'ok' ? '#95de64' : model.status === 'unconfigured' ? '#ff7875' : '#8b949e',
                    }}
                  >
                    {model.status === 'ok' ? '✓' : model.status === 'unconfigured' ? '✗' : '?'}{' '}
                    {model.label}
                  </Tag>
                </Tooltip>
              ))}
            </div>
            {!aiAllOk && (
              <span style={{ fontSize: 10, color: '#faad14', marginTop: 2 }}>
                ⚠ 未配置的模型需在 backend/.env 中设置 API Key
              </span>
            )}
          </div>

          {/* 活跃问题列表 */}
          {hasIssues && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={() => setShowAllIssues(!showAllIssues)}
                style={{
                  fontSize: 11,
                  color: '#8b949e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textAlign: 'left',
                }}
              >
                <AlertIcon />
                <span>活跃问题 ({activeIssues.length})</span>
                <span style={{ marginLeft: 'auto', color: '#58a6ff' }}>
                  {showAllIssues ? '▲ 收起' : '▼ 展开'}
                </span>
              </button>
              {activeIssues.slice(0, showAllIssues ? activeIssues.length : 5).map(issue => (
                <div
                  key={issue.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: `rgba(${issue.level === 'critical' ? '255,77,79' : issue.level === 'warning' ? '250,173,20' : '24,144,255'},0.08)`,
                    border: `1px solid ${issueColor(issue.level)}30`,
                  }}
                >
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: issueColor(issue.level),
                    marginTop: 4,
                    flexShrink: 0,
                    animation: issue.level === 'critical' ? 'pulse-glow 1.5s infinite' : undefined,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: issueColor(issue.level) }}>
                      {issue.title}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2, wordBreak: 'break-word' }}>
                      {issue.detail}
                    </div>
                  </div>
                  {onDismissIssue && (
                    <button
                      onClick={() => onDismissIssue(issue.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#8b949e',
                        padding: 2,
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      <CloseIcon />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ====== 子组件：状态行 ======
interface StatusRowProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  value: string;
  extra?: string;
  subInfo?: string;
  onAction?: { label: string; onClick?: () => void };
}

const StatusRow: React.FC<StatusRowProps> = ({ icon, label, color, value, extra, subInfo, onAction }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#8b949e' }}>{icon}</span>
        <span style={{ fontSize: 11, color: '#8b949e' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {extra && <span style={{ fontSize: 10, color: '#8b949e' }}>{extra}</span>}
        <span style={{ fontSize: 11, fontWeight: 600, color }}>{value}</span>
        {onAction && (
          <button
            onClick={onAction.onClick}
            style={{
              fontSize: 10,
              color: '#58a6ff',
              background: 'rgba(88,166,255,0.1)',
              border: '1px solid rgba(88,166,255,0.2)',
              borderRadius: 4,
              padding: '1px 6px',
              cursor: 'pointer',
            }}
          >
            {onAction.label}
          </button>
        )}
      </div>
    </div>
    {subInfo && (
      <div style={{ fontSize: 10, color: '#faad14', marginTop: 3, marginLeft: 18 }}>
        {subInfo}
      </div>
    )}
  </div>
);

// ====== 子组件：Tooltip内容 ======
const StatusTooltip: React.FC<{ diagnostics: SystemDiagnostics; onRetry?: () => void }> = ({ diagnostics, onRetry }) => {
  const { wsStatus, wsLatency, backendStatus, backendLatency, aiModels, activeIssues } = diagnostics;

  return (
    <div style={{ fontSize: 12, color: '#e6edf3' }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: '#58a6ff' }}>实时系统状态</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: '#8b949e' }}>WebSocket</span>
          <span style={{ color: wsColor(wsStatus) }}>{wsLabel(wsStatus)}{wsLatency !== null ? ` (${wsLatency}ms)` : ''}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: '#8b949e' }}>后端API</span>
          <span style={{ color: backendColor(backendStatus) }}>
            {backendStatus === 'online' ? `在线 ${backendLatency ?? '--'}ms` : backendStatus === 'offline' ? '离线' : backendStatus}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: '#8b949e' }}>AI三模型</span>
          <span>
            {aiModels.map(m => (
              <span key={m.key} style={{ marginLeft: 4, color: m.status === 'ok' ? '#52c41a' : '#ff4d4f' }}>
                {m.label.slice(0, 1)}{m.status === 'ok' ? '✓' : '✗'}
              </span>
            ))}
          </span>
        </div>
        {activeIssues.length > 0 && (
          <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {activeIssues.slice(0, 3).map(i => (
              <div key={i.id} style={{ color: i.level === 'critical' ? '#ff7875' : '#faad14', fontSize: 11 }}>
                • {i.title}
              </div>
            ))}
          </div>
        )}
        {onRetry && (backendStatus === 'offline' || wsStatus === 'disconnected') && (
          <button
            onClick={onRetry}
            style={{
              marginTop: 6,
              padding: '3px 10px',
              background: 'rgba(88,166,255,0.15)',
              border: '1px solid rgba(88,166,255,0.3)',
              borderRadius: 6,
              color: '#58a6ff',
              cursor: 'pointer',
              fontSize: 11,
              width: '100%',
            }}
          >
            重试连接
          </button>
        )}
      </div>
    </div>
  );
};

export default SystemStatusPanel;
