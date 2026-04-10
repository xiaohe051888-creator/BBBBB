/**
 * 智能警告面板组件
 * 显示数据完整性警告、异常模式警告、智能提醒等
 */
import React from 'react';
import type { DataIntegrityIssue, AbnormalPattern, SmartAlert } from '../../hooks';

// ====== 类型定义 ======

interface SmartAlertsProps {
  integrityIssues: DataIntegrityIssue[];
  abnormalPatterns: AbnormalPattern[];
  alerts: SmartAlert[];
  onFixIssue?: (issue: DataIntegrityIssue) => void;
  onDismissAlert?: (id: string) => void;
}

// ====== 组件 ======

export const SmartAlertsPanel: React.FC<SmartAlertsProps> = ({
  integrityIssues,
  abnormalPatterns,
  alerts,
  onFixIssue,
  onDismissAlert,
}) => {
  const hasIssues = integrityIssues.length > 0 || abnormalPatterns.length > 0 || alerts.length > 0;

  if (!hasIssues) {
    return (
      <div style={styles.empty}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="rgba(82,196,26,0.5)">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span style={styles.emptyText}>系统状态正常，未检测到异常</span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 数据完整性警告 */}
      {integrityIssues.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#faad14">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
            <span style={styles.sectionTitle}>数据完整性警告 ({integrityIssues.length})</span>
          </div>
          {integrityIssues.map((issue, index) => (
            <div key={index} style={{ ...styles.issueCard, borderColor: issue.severity === 'error' ? '#ff4d4f' : '#faad14' }}>
              <div style={styles.issueHeader}>
                <span style={{ ...styles.issueType, color: issue.severity === 'error' ? '#ff4d4f' : '#faad14' }}>
                  {getIssueTypeLabel(issue.type)}
                </span>
                {issue.severity === 'error' && <span style={styles.errorBadge}>错误</span>}
              </div>
              <p style={styles.issueMessage}>{issue.message}</p>
              {onFixIssue && (
                <button style={styles.fixButton} onClick={() => onFixIssue(issue)}>
                  修复
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 异常模式警告 */}
      {abnormalPatterns.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff4d4f">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <span style={styles.sectionTitle}>异常模式检测 ({abnormalPatterns.length})</span>
          </div>
          {abnormalPatterns.map((pattern, index) => (
            <div key={index} style={{ ...styles.patternCard, borderColor: getSeverityColor(pattern.severity) }}>
              <div style={styles.patternHeader}>
                <span style={{ ...styles.patternType, color: getSeverityColor(pattern.severity) }}>
                  {getPatternTypeLabel(pattern.type)}
                </span>
                <span style={{ ...styles.severityBadge, background: getSeverityBg(pattern.severity) }}>
                  {pattern.severity === 'danger' ? '危险' : pattern.severity === 'warning' ? '警告' : '提示'}
                </span>
              </div>
              <p style={styles.patternMessage}>{pattern.message}</p>
              <p style={styles.patternDetails}>{pattern.details}</p>
            </div>
          ))}
        </div>
      )}

      {/* 智能提醒 */}
      {alerts.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#1890ff">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
            </svg>
            <span style={styles.sectionTitle}>系统提醒 ({alerts.length})</span>
          </div>
          {alerts.map((alert) => (
            <div key={alert.id} style={{ ...styles.alertCard, borderColor: getAlertColor(alert.type) }}>
              <div style={styles.alertHeader}>
                <span style={{ ...styles.alertTitle, color: getAlertColor(alert.type) }}>{alert.title}</span>
                {onDismissAlert && (
                  <button style={styles.dismissButton} onClick={() => onDismissAlert(alert.id)}>
                    ✕
                  </button>
                )}
              </div>
              <p style={styles.alertMessage}>{alert.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 辅助函数
function getIssueTypeLabel(type: DataIntegrityIssue['type']): string {
  const labels: Record<string, string> = {
    missing: '数据缺失',
    duplicate: '重复数据',
    jump: '局号跳跃',
    format: '格式错误',
  };
  return labels[type] || type;
}

function getPatternTypeLabel(type: AbnormalPattern['type']): string {
  const labels: Record<string, string> = {
    consecutive: '连续结果',
    win_rate_drop: '胜率下降',
    large_bet: '大额下注',
    balance_low: '余额不足',
  };
  return labels[type] || type;
}

function getSeverityColor(severity: AbnormalPattern['severity']): string {
  const colors: Record<string, string> = {
    info: '#1890ff',
    warning: '#faad14',
    danger: '#ff4d4f',
  };
  return colors[severity] || '#1890ff';
}

function getSeverityBg(severity: AbnormalPattern['severity']): string {
  const colors: Record<string, string> = {
    info: 'rgba(24,144,255,0.2)',
    warning: 'rgba(250,173,20,0.2)',
    danger: 'rgba(255,77,79,0.2)',
  };
  return colors[severity] || 'rgba(24,144,255,0.2)';
}

function getAlertColor(type: SmartAlert['type']): string {
  const colors: Record<string, string> = {
    info: '#1890ff',
    warning: '#faad14',
    danger: '#ff4d4f',
    success: '#52c41a',
  };
  return colors[type] || '#1890ff';
}

// 样式
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: 'rgba(255,255,255,0.5)',
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.8)',
  },
  issueCard: {
    padding: 12,
    borderRadius: 8,
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,77,79,0.3)',
    borderLeftWidth: 3,
  },
  issueHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  issueType: {
    fontSize: 12,
    fontWeight: 600,
  },
  errorBadge: {
    padding: '2px 8px',
    borderRadius: 4,
    background: 'rgba(255,77,79,0.2)',
    color: '#ff7875',
    fontSize: 10,
    fontWeight: 600,
  },
  issueMessage: {
    margin: '0 0 8px 0',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: '18px',
  },
  fixButton: {
    padding: '4px 12px',
    borderRadius: 4,
    border: '1px solid rgba(24,144,255,0.4)',
    background: 'rgba(24,144,255,0.1)',
    color: '#69c0ff',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
  patternCard: {
    padding: 12,
    borderRadius: 8,
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,77,79,0.3)',
    borderLeftWidth: 3,
  },
  patternHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  patternType: {
    fontSize: 12,
    fontWeight: 600,
  },
  severityBadge: {
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 600,
  },
  patternMessage: {
    margin: '0 0 4px 0',
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: 500,
  },
  patternDetails: {
    margin: 0,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: '16px',
  },
  alertCard: {
    padding: 12,
    borderRadius: 8,
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(24,144,255,0.3)',
    borderLeftWidth: 3,
  },
  alertHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: 600,
  },
  dismissButton: {
    padding: '2px 6px',
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    cursor: 'pointer',
  },
  alertMessage: {
    margin: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: '18px',
  },
};

export default SmartAlertsPanel;
