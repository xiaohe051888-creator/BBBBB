/**
 * ValidationPanel - 数据验证面板组件
 * 包含版本信息和安全提示
 */
import React from 'react';

interface ValidationPanelProps {
  version?: string;
}

// 安全图标
const ShieldIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(82,196,26,0.7)">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
  </svg>
);

// 版本图标
const VersionIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
  </svg>
);

export const ValidationPanel: React.FC<ValidationPanelProps> = () => {
  // 底部信息已移除
  return null;
};
