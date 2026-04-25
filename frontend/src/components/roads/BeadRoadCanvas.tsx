/**
 * 珠盘路 (Bead Road) Canvas 组件 - 简化版
 * 
 * 核心原则：
 * - 固定 14列 × 6行，不滚动
 * - 只负责绘制，不管理滚动
 * 
 * 规则：
 * - 固定 14列 × 6行 网格布局
 * - 从左到右、从上到下依次填入
 * - 庄=红, 闲=蓝
 */
import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import type { RoadData, RoadCanvasConfig } from '../../types/road';
import { BEAD_ROAD_CONFIG, ROAD_COLORS, calculateBeadRoadSize } from '../../types/road';
import {
  getPointColor,
  drawGrid,
} from '../../utils/canvasRenderer';

interface BeadRoadCanvasProps {
  data: RoadData | null;
  config?: Partial<RoadCanvasConfig>;
  className?: string;
  style?: React.CSSProperties;
}

const BeadRoadCanvas: React.FC<BeadRoadCanvasProps> = ({
  data,
  config: customConfig,
  className,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mergedConfig = useMemo(() => ({ ...BEAD_ROAD_CONFIG, ...customConfig }), [customConfig]);

  // 固定尺寸
  const fixedSize = useMemo(() => calculateBeadRoadSize(mergedConfig), [mergedConfig]);

  // Canvas像素尺寸
  const canvasPixelSize = useMemo(() => {
    const dpr = window.devicePixelRatio || 1;
    return {
      width: Math.round(fixedSize.width * dpr),
      height: Math.round(fixedSize.height * dpr),
      styleWidth: fixedSize.width,
      styleHeight: fixedSize.height,
      dpr,
    };
  }, [fixedSize]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 设置高分屏缩放
    ctx.setTransform(canvasPixelSize.dpr, 0, 0, canvasPixelSize.dpr, 0, 0);

    const displayWidth = canvasPixelSize.styleWidth;
    const displayHeight = canvasPixelSize.styleHeight;

    // 背景
    ctx.fillStyle = ROAD_COLORS.background;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    const cellSize = mergedConfig.cellSize;
    const cellGap = mergedConfig.cellGap;
    const padding = mergedConfig.padding;
    const fixedCols = 12; // 珠盘路永远显示完整的 6x12
    const fixedRows = 6;

    // 计算列偏移量（如果超过12列，向左移动以显示最新数据）
    const maxCol = data && data.points.length > 0 
      ? Math.max(...data.points.map(p => p.column)) 
      : 0;
    const offsetCol = Math.max(0, maxCol - 11);

    // 始终绘制完整网格
    if (mergedConfig.showGrid) {
      drawGrid(ctx, mergedConfig, fixedCols, fixedRows);
    }

    // 无数据时直接返回（不显示文字，由父组件处理空状态）
    if (!data || !data.points.length) {
      return;
    }

    // 按坐标绘制点
    for (const point of data.points) {
      const displayCol = point.column - offsetCol;
      // 只绘制当前可视范围内的 12 列数据
      if (displayCol < 0 || displayCol >= fixedCols || point.row >= fixedRows) continue;

      const x = padding + displayCol * (cellSize + cellGap) + cellSize / 2;
      const y = padding + point.row * (cellSize + cellGap) + cellSize / 2;

      const color = getPointColor(point.value, false);
      
      // 绘制实心圆
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, cellSize / 2 - 1, 0, Math.PI * 2);
      ctx.fill();
      
      // 绘制文字
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(8, cellSize * 0.35)}px -apple-system, "PingFang SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let displayText = '';
      if (point.value === '庄') displayText = '庄';
      else if (point.value === '闲') displayText = '闲';
      else if (point.value === '和') displayText = '和';
      else displayText = '?';
      
      ctx.fillText(displayText, x, y);
      ctx.restore();
      
      // 错误标记
      if (point.error_id) {
        ctx.fillStyle = ROAD_COLORS.errorMark;
        ctx.beginPath();
        const radius = cellSize / 2 - 1;
        ctx.moveTo(x + radius * 0.3, y - radius * 0.5);
        ctx.lineTo(x + radius * 0.7, y - radius * 0.1);
        ctx.lineTo(x + radius * 0.5, y - radius * 0.3);
        ctx.closePath();
        ctx.fill();
      }
    }
  }, [data, mergedConfig, canvasPixelSize]);

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
      width={canvasPixelSize.width}
      height={canvasPixelSize.height}
      style={{
        display: 'block',
        width: canvasPixelSize.styleWidth,
        height: canvasPixelSize.styleHeight,
        ...style,
      }}
    />
  );
};

export default BeadRoadCanvas;
