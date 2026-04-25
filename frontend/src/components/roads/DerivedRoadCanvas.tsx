/**
 * 派生路 (Derived Road) Canvas 组件 - 简化版
 * 
 * 用于：大眼仔路、小路、螳螂路
 * 核心原则：
 * - 只负责绘制，不管理滚动
 * - 精确6格高度，禁止垂直滚动
 * 
 * 规则：
 * - 排列规则与大路相同（同色往下，变色换列）
 * - 颜色不代表庄闲！
 *   - 延(红) = 重复/与前参照列同行有值
 *   - 转(蓝) = 转折/与前参照列同行无值
 */
import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type { RoadData, RoadCanvasConfig } from '../../types/road';
import { DERIVED_ROAD_CONFIG, ROAD_COLORS, calculateRoadHeight } from '../../types/road';
import {
  getPointColor,
  drawRoadPoint,
  drawGrid,
  RoadStyle,
} from '../../utils/canvasRenderer';

interface DerivedRoadCanvasProps {
  data: RoadData | null;
  config?: Partial<RoadCanvasConfig>;
  className?: string;
  style?: React.CSSProperties;
}

const DerivedRoadCanvas: React.FC<DerivedRoadCanvasProps> = ({
  data,
  config: customConfig,
  className,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mergedConfig = useMemo(() => ({ ...DERIVED_ROAD_CONFIG, ...customConfig }), [customConfig]);

  // 监听容器宽度，计算可显示的列数
  const [containerWidth, setContainerWidth] = useState(0);
  
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    
    updateWidth();
    
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    window.addEventListener('resize', updateWidth);
    
    return () => {
      window.removeEventListener('resize', updateWidth);
      resizeObserver.disconnect();
    };
  }, []);
  
  // 根据容器宽度计算可显示的列数
  const visibleCols = useMemo(() => {
    if (containerWidth <= 0) return 10;
    const { cellSize, cellGap, padding } = mergedConfig;
    const availableWidth = containerWidth - padding * 2;
    return Math.max(10, Math.floor(availableWidth / (cellSize + cellGap)));
  }, [containerWidth, mergedConfig]);
  
  // 计算内容宽度：根据容器宽度显示满列，数据超出时扩展
  const contentWidth = useMemo(() => {
    const dataCols = data?.max_columns || 0;
    const totalCols = Math.max(dataCols, visibleCols);
    return mergedConfig.padding * 2 + totalCols * (mergedConfig.cellSize + mergedConfig.cellGap);
  }, [data, visibleCols, mergedConfig]);

  // 固定6格高度
  const fixedHeight = useMemo(() => calculateRoadHeight(mergedConfig), [mergedConfig]);

  // Canvas像素尺寸
  const canvasPixelSize = useMemo(() => {
    const dpr = window.devicePixelRatio || 1;
    return {
      width: Math.round(contentWidth * dpr),
      height: Math.round(fixedHeight * dpr),
      styleWidth: contentWidth,
      styleHeight: fixedHeight,
      dpr,
    };
  }, [contentWidth, fixedHeight]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布并设置高分屏缩放
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(canvasPixelSize.dpr, 0, 0, canvasPixelSize.dpr, 0, 0);

    const displayWidth = canvasPixelSize.styleWidth;
    const displayHeight = canvasPixelSize.styleHeight;

    // 背景
    ctx.fillStyle = ROAD_COLORS.background;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    const cellSize = mergedConfig.cellSize;
    const cellGap = mergedConfig.cellGap;
    const padding = mergedConfig.padding;

    // 根据容器宽度显示满列，至少10列
    const totalCols = Math.max(data?.max_columns || 0, visibleCols);

    // 网格（只画6行）
    if (mergedConfig.showGrid) {
      drawGrid(ctx, mergedConfig, totalCols, 6);
    }

    // 无数据时不绘制点
    if (!data || !data.points.length) {
      return;
    }

    // 绘制点
    for (const point of data.points) {
      const x = padding + point.column * (cellSize + cellGap) + cellSize / 2;
      const y = padding + point.row * (cellSize + cellGap) + cellSize / 2;

      const color = getPointColor(point.value, true);

      // 根据路类型选择样式
      let roadStyle = RoadStyle.HOLLOW_CIRCLE;
      
      if (data.road_type === 'small_road') {
        roadStyle = RoadStyle.SOLID_CIRCLE;
      } else if (data.road_type === 'cockroach_road') {
        roadStyle = RoadStyle.SLASH;
      }

      drawRoadPoint(ctx, x, y, cellSize / 2 - 1, color, roadStyle, !!point.error_id);
    }
  }, [data, mergedConfig, canvasPixelSize, visibleCols]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        className={className}
        width={canvasPixelSize.width}
        height={canvasPixelSize.height}
        style={{
          display: 'block',
          width: canvasPixelSize.styleWidth,
          height: canvasPixelSize.styleHeight,
          ...style,
        }}
      />
    </div>
  );
};

export default DerivedRoadCanvas;
