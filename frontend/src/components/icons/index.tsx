/**
 * 统一图标库 - BBBBB 项目
 * 
 * 所有自定义 SVG 图标集中定义在这里，避免重复定义
 * 使用方式: import { ReloadIcon, UploadIcon } from '../components/icons';
 */
import React from 'react';

interface IconProps {
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

// 默认图标属性 - 供组件内部使用
const _defaultIconProps: IconProps = {
  width: 14,
  height: 14,
  color: 'currentColor',
};
// 避免未使用变量警告
void _defaultIconProps;

// ====== 通用图标 ======

export const ReloadIcon: React.FC<IconProps> = ({ width = 14, height = 14, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
  </svg>
);

export const UploadIcon: React.FC<IconProps> = ({ width = 14, height = 14, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
  </svg>
);

export const LockIcon: React.FC<IconProps> = ({ width = 14, height = 14, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
  </svg>
);

export const UnlockIcon: React.FC<IconProps> = ({ width = 14, height = 14, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/>
  </svg>
);

export const ChartIcon: React.FC<IconProps> = ({ width = 18, height = 18, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
  </svg>
);

export const TargetIcon: React.FC<IconProps> = ({ width = 16, height = 16, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3-8c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/>
  </svg>
);

export const CoinIcon: React.FC<IconProps> = ({ width = 16, height = 16, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/>
  </svg>
);

export const ClockIcon: React.FC<IconProps> = ({ width = 14, height = 14, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
  </svg>
);

export const FileIcon: React.FC<IconProps> = ({ width = 14, height = 14, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
  </svg>
);

export const ShieldIcon: React.FC<IconProps> = ({ width = 14, height = 14, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
  </svg>
);

export const GlobeIcon: React.FC<IconProps> = ({ width = 14, height = 14, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>
);

export const RobotIcon: React.FC<IconProps> = ({ width = 14, height = 14, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M12 2c-4.97 0-9 4.03-9 9 0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.31C18.16 18.67 21 15.17 21 11c0-4.97-4.03-9-9-9zm0 2c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.3c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
  </svg>
);

export const FireIcon: React.FC<IconProps> = ({ width = 14, height = 14, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/>
  </svg>
);

export const BulbIcon: React.FC<IconProps> = ({ width = 14, height = 14, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/>
  </svg>
);

// ====== 专用图标 ======

export const ArrowRightIcon: React.FC<IconProps> = ({ width = 16, height = 16, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className} style={{ transform: 'rotate(45deg)' }}>
    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
  </svg>
);

export const CloudUploadIcon: React.FC<IconProps> = ({ width = 48, height = 48, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
  </svg>
);

export const NotificationIcon: React.FC<IconProps> = ({ width = 16, height = 16, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
  </svg>
);

export const InfoIcon: React.FC<IconProps> = ({ width = 16, height = 16, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
  </svg>
);

export const WarningIcon: React.FC<IconProps> = ({ width = 16, height = 16, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
  </svg>
);

export const CheckCircleIcon: React.FC<IconProps> = ({ width = 16, height = 16, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
);

export const ErrorIcon: React.FC<IconProps> = ({ width = 16, height = 16, color = 'currentColor', className }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill={color} className={className}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
  </svg>
);

// ====== 图标集合（兼容旧代码）=======

/**
 * 旧版图标集合 - 用于兼容现有代码
 * 新代码建议直接使用具名导入
 * @deprecated 请直接使用具名导入
 */
// eslint-disable-next-line react-refresh/only-export-components
export const Icons = {
  Reload: ReloadIcon,
  Upload: UploadIcon,
  Lock: LockIcon,
  Unlock: UnlockIcon,
  Chart: ChartIcon,
  Target: TargetIcon,
  Coin: CoinIcon,
  Clock: ClockIcon,
  File: FileIcon,
  Shield: ShieldIcon,
  Globe: GlobeIcon,
  Robot: RobotIcon,
  Fire: FireIcon,
  Bulb: BulbIcon,
  ArrowRight: ArrowRightIcon,
  CloudUpload: CloudUploadIcon,
  Notification: NotificationIcon,
  Info: InfoIcon,
  Warning: WarningIcon,
  CheckCircle: CheckCircleIcon,
  Error: ErrorIcon,
};

export default Icons;
