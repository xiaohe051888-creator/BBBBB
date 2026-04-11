/**
 * 上传页面专用图标组件
 * 提供 UploadPage 中使用的所有精致 SVG 图标
 */
import React from 'react';

// 管理员图标
export const AdminIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
  </svg>
);

// 上传图标
export const UploadIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
  </svg>
);

// 仪表盘图标
export const DashboardIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
  </svg>
);

// 清空图标
export const ClearIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
  </svg>
);

// 数字填充图标
export const NumberFillIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-4H8v-2h2V9h2v2h2v2h-2v4z"/>
  </svg>
);

// 锁图标
export const LockIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
  </svg>
);

// 钥匙图标
export const KeyIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
  </svg>
);

// 信息图标
export const InfoIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
  </svg>
);

// 减号图标
export const MinusIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13H5v-2h14v2z"/>
  </svg>
);

// 加号图标
export const PlusIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>
);

// 勾选图标
export const CheckIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
  </svg>
);

// 关闭图标
export const CloseIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
);

// 赌场筹码图标
export const CasinoIcon: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="chipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffd700"/>
        <stop offset="50%" stopColor="#ffed4e"/>
        <stop offset="100%" stopColor="#d4af37"/>
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" fill="url(#chipGrad)" stroke="#b8860b" strokeWidth="0.5"/>
    <circle cx="12" cy="12" r="7" fill="none" stroke="#b8860b" strokeWidth="0.5"/>
    <circle cx="12" cy="12" r="4" fill="#fff" fillOpacity="0.3"/>
    <rect x="11" y="2" width="2" height="4" fill="#b8860b"/>
    <rect x="11" y="18" width="2" height="4" fill="#b8860b"/>
    <rect x="2" y="11" width="4" height="2" fill="#b8860b"/>
    <rect x="18" y="11" width="4" height="2" fill="#b8860b"/>
  </svg>
);

// 导出为对象方便批量使用
// eslint-disable-next-line react-refresh/only-export-components
export const UploadIcons = {
  Admin: AdminIcon,
  Upload: UploadIcon,
  Dashboard: DashboardIcon,
  Clear: ClearIcon,
  NumberFill: NumberFillIcon,
  Lock: LockIcon,
  Key: KeyIcon,
  Info: InfoIcon,
  Minus: MinusIcon,
  Plus: PlusIcon,
  Check: CheckIcon,
  Close: CloseIcon,
  Casino: CasinoIcon,
};
