/**
 * 珠盘路 (Bead Road) Canvas 组件
 * 
 * 规则：
 * - 14列 × 6行 固定网格
 * - 从左到右、从下到上依次填入
 * - 颜色表示庄/闲（与大路一致）
 * - 数据超过84个(14*6)时循环覆盖
 */
import React, { useRef, useEffect, useCallback } from 'react';
import type { RoadData, RoadCanvasConfig } from '../../types/road';
import { BEAD_ROAD_CONFIG } from '../../types/road';
import {
  getPointColor,
  drawCircle,
  drawGrid,
} from '../../utils/canvasRenderer';

interface BeadRoadCanvasProps {
  data: RoadData | null;
  config?: Partial<RoadCanvasConfig>;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

const BeadRoadCanvas: React.FC<BeadRoadCanvasProps> = ({
  data,
  config: customConfig,
  width: externalWidth,
  height: externalHeight,
  className,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mergedConfig = { ...BEAD_ROAD_CONFIG, ...customConfig };

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
      // 珠盘路固定14列
      const fixedCols = 14;
      const fixedRows = Math.max(data?.max_rows ?? 1, 1);
      const cellSize = mergedConfig.cellSize;
      const cellGap = mergedConfig.cellGap;
      const padding = mergedConfig.padding;
      canvasWidth = (padding * 2 + fixedCols * (cellSize + cellGap)) * dpr;
      canvasHeight = (padding * 2 + fixedRows * (cellSize + cellGap)) * dpr;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = `${canvasWidth / dpr}px`;
    canvas.style.height = `${canvasHeight / dpr}px`;

    ctx.scale(dpr, dpr);

    const displayWidth = canvasWidth / dpr;
    const displayHeight = canvasHeight / dpr;

    // 背景
    ctx.fillStyle = '#0d1117';
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
    const fixedCols = 14;
    const totalRows = Math.max(data.max_rows, 1);

    // 绘制网格
    if (mergedConfig.showGrid) {
      drawGrid(ctx, mergedConfig, fixedCols, totalRows);
    }

    // 按坐标绘制点（珠盘路是固定14列网格布局）
    for (const point of data.points) {
      if (point.column >= fixedCols) continue; // 超出范围的点不显示

      const x = padding + point.column * (cellSize + cellGap) + cellSize / 2;
      // 珠盘路的row是从下往上排列的，但后端返回的已经是正确坐标，直接用即可
      const y = padding + point.row * (cellSize + cellGap) + cellSize / 2;

      const color = getPointColor(point.value, false);
      drawCircle(ctx, x, y, cellSize / 2 - 1, color, mergedConfig.borderRadius, !!point.error_id);
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

export default BeadRoadCanvas;
