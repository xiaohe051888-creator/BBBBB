/**
 * 派生路 (Derived Road) Canvas 组件
 * 
 * 用于：大眼仔路、小路、螳螂路
 * 规则：
 * - 排列规则与大路相同（同色往下，变色换列）
 * - 颜色不代表庄闲！
 *   - 延(红) = 重复/与前参照列同行有值
 *   - 转(蓝) = 转折/与前参照列同行无值
 * - 比较偏移量: 大眼仔=1, 小路=2, 螳螂=3
 */
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import type { RoadData, RoadCanvasConfig } from '../../types/road';
import { DERIVED_ROAD_CONFIG, ROAD_COLORS } from '../../types/road';
import {
  calcCanvasSize,
  getPointColor,
  drawRoadPoint,
  drawGrid,
  RoadStyle,
} from '../../utils/canvasRenderer';

interface DerivedRoadCanvasProps {
  data: RoadData | null;
  config?: Partial<RoadCanvasConfig>;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

const DerivedRoadCanvas: React.FC<DerivedRoadCanvasProps> = ({
  data,
  config: customConfig,
  width: externalWidth,
  height: externalHeight,
  className,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mergedConfig = useMemo(() => ({ ...DERIVED_ROAD_CONFIG, ...customConfig }), [customConfig]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let canvasWidth: number;
    let canvasHeight: number;

    if (externalWidth && externalHeight) {
      canvasWidth = externalWidth * dpr;
      canvasHeight = externalHeight * dpr;
    } else {
      const size = calcCanvasSize(data, mergedConfig);
      canvasWidth = size.width * dpr;
      canvasHeight = size.height * dpr;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = `${canvasWidth / dpr}px`;
    canvas.style.height = `${canvasHeight / dpr}px`;

    ctx.scale(dpr, dpr);

    const displayWidth = canvasWidth / dpr;
    const displayHeight = canvasHeight / dpr;

    // 背景
    ctx.fillStyle = ROAD_COLORS.background;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    if (!data || !data.points.length) {
      ctx.fillStyle = '#30363d';
      ctx.font = `${mergedConfig.fontSize}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('等待数据...', displayWidth / 2, displayHeight / 2);
      return;
    }

    const cellSize = mergedConfig.cellSize;
    const cellGap = mergedConfig.cellGap;
    const padding = mergedConfig.padding;
    const totalCols = Math.max(data.max_columns, 1);
    const totalRows = Math.max(data.max_rows, 1);

    // 网格
    if (mergedConfig.showGrid) {
      drawGrid(ctx, mergedConfig, totalCols, totalRows);
    }

    // 派生路的值域是 "延" | "转"，使用派生路颜色
    for (const point of data.points) {
      const x = padding + point.column * (cellSize + cellGap) + cellSize / 2;
      const y = padding + point.row * (cellSize + cellGap) + cellSize / 2;

      // isDerived=true 使用派生路颜色（延=红, 转=蓝）
      const color = getPointColor(point.value, true);

      // ★ 权威标准：三种派生路使用不同的显示样式 ★
      let roadStyle = RoadStyle.SOLID_CIRCLE; // 默认实心圆
      
      if (data.road_type === 'small_road') {
        roadStyle = RoadStyle.HOLLOW_CIRCLE;  // 小路：空心圆
      } else if (data.road_type === 'cockroach_road') {
        roadStyle = RoadStyle.SLASH;          // 螳螂路：斜杠
      }
      // 大眼仔路保持默认（实心圆）

      // 绘制相应样式的点
      drawRoadPoint(ctx, x, y, cellSize / 2 - 1, color, roadStyle, !!point.error_id);
    }
  }, [data, mergedConfig, externalWidth, externalHeight]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: 'block',
        borderRadius: '8px',
        ...style,
      }}
    />
  );
};

export default DerivedRoadCanvas;
