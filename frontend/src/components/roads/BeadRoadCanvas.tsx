/**
 * 珠盘路 (Bead Road) Canvas 组件
 * 
 * 规则（标准百家乐）:
 * - 固定 14列 × 6行 网格布局
 * - 从左到右、从上到下依次填入（row=0在最上方一行）
 * - 颜色直接表示庄/闲（庄=红, 闲=蓝）
 * - 数据超过84个(14×6)时循环覆盖旧位置
 * - 与大路的区别: 大路是自适应行列+向下延伸; 珠盘路是固定网格
 */
import React, { useRef, useEffect, useCallback } from 'react';
import type { RoadData, RoadCanvasConfig } from '../../types/road';
import { BEAD_ROAD_CONFIG, ROAD_COLORS } from '../../types/road';
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
      // 珠盘路: 固定14列×6行网格（标准百家乐规则）
      const fixedCols = 14;
      const fixedRows = 6;  // ★ 固定6行，不依赖数据量
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
    const fixedCols = 14;       // 珠盘路固定14列
    const fixedRows = 6;        // ★ 珠盘路固定6行（不管数据多少都画完整网格）

    // 绘制网格（固定完整网格，不是只画有数据的部分）
    if (mergedConfig.showGrid) {
      drawGrid(ctx, mergedConfig, fixedCols, fixedRows);
    }

    // 按坐标绘制点
    for (const point of data.points) {
      if (point.column >= fixedCols) continue; // 超出范围的点不显示

      const x = padding + point.column * (cellSize + cellGap) + cellSize / 2;
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
