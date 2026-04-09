/**
 * 走势图卡片组件
 * 用于包裹单个走势图的容器组件
 */
import React from 'react';
import { ROAD_COLORS } from '../../types/road';

interface RoadCardProps {
  /** 标题 */
  title: React.ReactNode;
  /** 右侧额外信息 */
  extra?: React.ReactNode;
  /** 子内容 */
  children: React.ReactNode;
  /** 最小高度 */
  minHeight?: number;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 是否占满整行 */
  fullWidth?: boolean;
}

/**
 * 走势图卡片组件
 */
const RoadCard: React.FC<RoadCardProps> = ({
  title,
  extra,
  children,
  minHeight = 130,
  style,
  fullWidth = false,
}) => {
  return (
    <div
      style={{
        background: ROAD_COLORS.background,
        borderRadius: 8,
        padding: fullWidth ? 10 : 8,
        minHeight,
        overflow: 'hidden',
        border: '1px solid #21262d',
        ...style,
      }}
    >
      {/* 标题栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: fullWidth ? 12 : 11,
          color: '#8b949e',
          marginBottom: fullWidth ? 8 : 6,
          fontWeight: 600,
        }}
      >
        <span>{title}</span>
        {extra && (
          <span style={{ fontSize: 10, fontWeight: 400, color: '#484f58' }}>
            {extra}
          </span>
        )}
      </div>

      {/* 内容区 */}
      <div style={{ height: fullWidth ? 200 : 110 }}>{children}</div>
    </div>
  );
};

export default RoadCard;
