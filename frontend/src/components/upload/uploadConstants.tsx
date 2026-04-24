/**
 * 上传页面常量定义
 * 游戏结果类型、颜色配置等
 */
import React from 'react';

// 游戏结果类型
export type GameResult = '庄' | '闲' | '和' | '';

// 默认局数 (6×12=72局)
export const DEFAULT_ROWS = 72;

// 珠盘路行数
export const BEAD_ROWS = 6;

// 珠盘路列数 (72局 = 6行×12列)
export const BEAD_COLS = 12;

// 快捷序列填充配置
export const QUICK_FILLS: { label: string; pattern: GameResult[]; icon: React.ReactNode }[] = [
  {
    label: '全庄',
    pattern: ['庄'],
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff4d4f">
        <circle cx="12" cy="12" r="10"/>
      </svg>
    )
  },
  {
    label: '全闲',
    pattern: ['闲'],
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#1890ff">
        <circle cx="12" cy="12" r="10"/>
      </svg>
    )
  },
  {
    label: '交替',
    pattern: ['庄', '闲'],
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 12h16M12 4v16"/>
      </svg>
    )
  },
];

// 上传页面图标
export const UploadIcons = {
  Upload: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/>
    </svg>
  ),
  Delete: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
    </svg>
  ),
  Clear: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  ),
  Submit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  Success: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="#52c41a">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  ),
  Minus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13H5v-2h14v2z"/>
    </svg>
  ),
  Plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </svg>
  ),
  NumberFill: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h6v2H7v-2z"/>
    </svg>
  ),
};

// 数字到结果的映射
export const NUM_TO_RESULT: Record<string, GameResult> = {
  '1': '庄',
  '2': '闲',
  '3': '和',
};

// 结果颜色配置
export const RESULT_COLORS: Record<string, string> = {
  '庄': '#ff4d4f',
  '闲': '#1890ff',
  '和': '#52c41a',
  '': 'rgba(255,255,255,0.15)',
};

// 结果背景色配置
export const RESULT_BG: Record<string, string> = {
  '庄': 'rgba(255,77,79,0.12)',
  '闲': 'rgba(24,144,255,0.12)',
  '和': 'rgba(82,196,26,0.12)',
  '': 'rgba(255,255,255,0.04)',
};
