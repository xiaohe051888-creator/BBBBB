/**
 * 骨架屏组件
 * 用于数据加载时的占位显示，提升用户体验
 */
import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
  /** 宽度，可以是数字（px）或字符串（如 '100%'） */
  width?: number | string;
  /** 高度，可以是数字（px）或字符串 */
  height?: number | string;
  /** 圆角大小 */
  borderRadius?: number | string;
  /** 是否显示动画 */
  animated?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 基础骨架屏组件
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 4,
  animated = true,
  className = '',
  style = {},
}) => {
  const widthValue = typeof width === 'number' ? `${width}px` : width;
  const heightValue = typeof height === 'number' ? `${height}px` : height;
  const radiusValue = typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius;

  return (
    <div
      className={`skeleton ${animated ? 'skeleton-animated' : ''} ${className}`}
      style={{
        width: widthValue,
        height: heightValue,
        borderRadius: radiusValue,
        ...style,
      }}
    />
  );
};

/**
 * 文本骨架屏 - 多行
 */
interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  width?: string | string[];
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  lineHeight = 16,
  width = '100%',
  className = '',
}) => {
  return (
    <div className={`skeleton-text ${className}`}>
      {Array.from({ length: lines }).map((_, index) => {
        const lineWidth = Array.isArray(width) ? width[index % width.length] : width;
        return (
          <Skeleton
            key={index}
            width={lineWidth}
            height={lineHeight}
            style={{ marginBottom: index < lines - 1 ? 8 : 0 }}
          />
        );
      })}
    </div>
  );
};

/**
 * 卡片骨架屏
 */
interface SkeletonCardProps {
  header?: boolean;
  contentLines?: number;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  header = true,
  contentLines = 3,
  className = '',
}) => {
  return (
    <div className={`skeleton-card ${className}`}>
      {header && (
        <div className="skeleton-card-header">
          <Skeleton width={120} height={20} borderRadius={4} />
          <Skeleton width={60} height={16} borderRadius={4} />
        </div>
      )}
      <div className="skeleton-card-content">
        <SkeletonText lines={contentLines} width={['100%', '90%', '80%']} />
      </div>
    </div>
  );
};

/**
 * 统计卡片骨架屏
 */
export const SkeletonStatCard: React.FC = () => {
  return (
    <div className="skeleton-stat-card">
      <Skeleton width={40} height={40} borderRadius={8} style={{ marginBottom: 12 }} />
      <Skeleton width={80} height={24} borderRadius={4} style={{ marginBottom: 8 }} />
      <Skeleton width={100} height={14} borderRadius={4} />
    </div>
  );
};

/**
 * 表格骨架屏
 */
interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 4,
  className = '',
}) => {
  return (
    <div className={`skeleton-table ${className}`}>
      {/* 表头 */}
      <div className="skeleton-table-header">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton
            key={`header-${colIndex}`}
            width={`${90 / columns}%`}
            height={20}
            borderRadius={4}
          />
        ))}
      </div>
      {/* 表格行 */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${colIndex}`}
              width={`${85 / columns}%`}
              height={16}
              borderRadius={4}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * 列表骨架屏
 */
interface SkeletonListProps {
  items?: number;
  className?: string;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  items = 5,
  className = '',
}) => {
  return (
    <div className={`skeleton-list ${className}`}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="skeleton-list-item">
          <Skeleton width={40} height={40} borderRadius="50%" />
          <div className="skeleton-list-content">
            <Skeleton width={120} height={16} borderRadius={4} style={{ marginBottom: 8 }} />
            <Skeleton width={80} height={12} borderRadius={4} />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * 走势图骨架屏
 */
export const SkeletonRoadMap: React.FC = () => {
  return (
    <div className="skeleton-roadmap">
      <div className="skeleton-roadmap-header">
        <Skeleton width={100} height={20} borderRadius={4} />
        <Skeleton width={60} height={16} borderRadius={4} />
      </div>
      <div className="skeleton-roadmap-grid">
        {Array.from({ length: 6 }).map((_, rowIndex) => (
          <div key={rowIndex} className="skeleton-roadmap-row">
            {Array.from({ length: 10 }).map((_, colIndex) => (
              <Skeleton
                key={`${rowIndex}-${colIndex}`}
                width={20}
                height={20}
                borderRadius="50%"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 页面级骨架屏 - Dashboard
 */
export const SkeletonDashboard: React.FC = () => {
  return (
    <div className="skeleton-page skeleton-dashboard">
      {/* 状态栏骨架 */}
      <div className="skeleton-status-bar">
        <Skeleton width={150} height={24} borderRadius={4} />
        <Skeleton width={200} height={20} borderRadius={4} />
      </div>

      {/* 统计卡片骨架 */}
      <div className="skeleton-stats-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonStatCard key={index} />
        ))}
      </div>

      {/* 主要内容区骨架 */}
      <div className="skeleton-main-content">
        <div className="skeleton-left-panel">
          <SkeletonCard header contentLines={4} />
          <SkeletonCard header contentLines={3} />
        </div>
        <div className="skeleton-right-panel">
          <SkeletonRoadMap />
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
