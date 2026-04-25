/**
 * SmartAlerts - 智能提示组件
 */
import React from 'react';
import { Alert, Space } from 'antd';
import type { DataIntegrityIssue, AbnormalPattern, SmartAlert } from '../../hooks/useSmartDetection';

interface SmartAlertsProps {
  alerts: SmartAlert[];
  integrityIssues?: DataIntegrityIssue[];
  abnormalPatterns?: AbnormalPattern[];
  onDismiss: (id: string) => void;
}

export const SmartAlerts: React.FC<SmartAlertsProps> = ({
  alerts,
  integrityIssues,
  abnormalPatterns,
  onDismiss,
}) => {
  if (alerts.length === 0 && !integrityIssues?.length && !abnormalPatterns?.length) {
    return null;
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {alerts.map((alert) => (
        <Alert
          key={alert.id}
          title={alert.title}
          description={alert.message}
          type={alert.type === 'danger' ? 'error' : alert.type === 'warning' ? 'warning' : alert.type === 'success' ? 'success' : 'info'}
          showIcon
          closable
          onClose={() => onDismiss?.(alert.id)}
          style={{ marginBottom: 12 }}
        />
      ))}
      {integrityIssues?.map((issue, index) => (
        <Alert
          key={`integrity-${index}`}
          message={issue.message}
          type={issue.severity}
          showIcon
        />
      ))}
      {abnormalPatterns?.map((pattern, index) => (
        <Alert
          key={`pattern-${index}`}
          message={pattern.message}
          type={pattern.severity === 'danger' ? 'error' : pattern.severity}
          showIcon
        />
      ))}
    </Space>
  );
};

export default SmartAlerts;
