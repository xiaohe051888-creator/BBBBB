/**
 * 大路图 (Big Road) Canvas 组件 - 简化版
 * 
 * 核心原则：
 * - 只负责绘制，不管理滚动
 * - 滚动由父组件 FiveRoadChart 统一管理
 * - 最新数据永远显示在最前（靠右）
 * 
 * 规则：
 * - 相同颜色一组最多6个，往下延伸
 * - 颜色变化必换列（column++, row=0）
 * - 每列最多6行（row: 0~5）
 * - 庄 = 红色圆, 闲 = 蓝色圆
 */
import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import type { RoadData, RoadCanvasConfig } from '../../types/road';
import { BIG_ROAD_CONFIG, ROAD_COLORS } from '../../types/road';
import {
  getPointColor,
  drawGrid,
  buildPointGrid,
  drawHollowCircle,
  drawAnimatedHollowCircle,
} from '../../utils/canvasRenderer';

interface BigRoadCanvasProps {
  data: RoadData | null;
  config?: Partial<RoadCanvasConfig>;
  className?: string;
  style?: React.CSSProperties;
  onPointClick?: (point: RoadData['points'][0]) => void;
  onPointHover?: (point: RoadData['points'][0] | null) => void;
}

const BigRoadCanvas: React.FC<BigRoadCanvasProps> = ({
  data,
  config: customConfig,
  className,
  style,
  onPointClick,
  onPointHover,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const mergedConfig = useMemo(() => ({ ...BIG_ROAD_CONFIG, ...customConfig }), [customConfig]);
  const lastGameNumber = useRef<number>(0);
  const pointPositionsRef = useRef<Map<string, RoadData['points'][0]>>(new Map());

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

  // 固定6行高度
  const fixedHeight = useMemo(() => {
    return mergedConfig.padding * 2 + 6 * (mergedConfig.cellSize + mergedConfig.cellGap);
  }, [mergedConfig]);

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

    const dpr = canvasPixelSize.dpr;
    const displayWidth = canvasPixelSize.styleWidth;
    const displayHeight = canvasPixelSize.styleHeight;

    // 清空画布
    ctx.fillStyle = ROAD_COLORS.background;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    const cellSize = mergedConfig.cellSize;
    const cellGap = mergedConfig.cellGap;
    const padding = mergedConfig.padding;

    // 根据容器宽度显示满列，至少10列
    const totalCols = Math.max(data?.max_columns || 0, visibleCols);

    // 绘制网格（始终显示）
    if (mergedConfig.showGrid) {
      drawGrid(ctx, mergedConfig, totalCols, 6);
    }

    // 无数据时不绘制点
    if (!data || !data.points.length) {
      return;
    }

    // 构建点网格
    const grid = buildPointGrid(data.points);
    pointPositionsRef.current.clear();

    // 检测新点动画
    const hasNewPoint = data.points.length > 0 && 
      data.points[data.points.length - 1].game_number > lastGameNumber.current;
    
    if (hasNewPoint) {
      lastGameNumber.current = data.points[data.points.length - 1].game_number;
      startTimeRef.current = performance.now();
    }

    const elapsed = hasNewPoint ? performance.now() - startTimeRef.current : Infinity;
    const animProgress = Math.min(elapsed / 600, 1);

    // 绘制每个点
    for (let col = 0; col < totalCols; col++) {
      const colPoints = grid.get(col);
      if (!colPoints) continue;

      for (const [row, point] of colPoints) {
        const x = padding + col * (cellSize + cellGap) + cellSize / 2;
        const y = padding + row * (cellSize + cellGap) + cellSize / 2;

        const color = getPointColor(point.value, false);
        const isLastPoint = point === data.points[data.points.length - 1];
        const radius = cellSize / 2 - 1;

        pointPositionsRef.current.set(`${Math.round(x)},${Math.round(y)}`, point);
        pointPositionsRef.current.set(`${col},${row}`, point);

        const hasTieMark = point.has_tie === true || point.is_tie === true;
        
        if (isLastPoint && hasNewPoint && animProgress < 1) {
          drawAnimatedHollowCircle(ctx, x, y, radius, color, animProgress, !!point.error_id, hasTieMark);
        } else {
          drawHollowCircle(ctx, x, y, radius, color, !!point.error_id, hasTieMark);
        }
      }
    }
  }, [data, mergedConfig, canvasPixelSize]);

  useEffect(() => {
    draw();

    const checkLastGameNum = data?.points[data?.points.length - 1]?.game_number ?? 0;
    if (checkLastGameNum > lastGameNumber.current) {
      const animate = () => {
        draw();
        const elapsed = performance.now() - startTimeRef.current;
        if (elapsed < 600) {
          animFrameRef.current = requestAnimationFrame(animate);
        }
      };
      animFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, data?.points.length]);

  // 窗口resize重绘
  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // 点击事件
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPointClick || !data?.points.length) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const clickX = (e.clientX - rect.left) * dpr;
    const clickY = (e.clientY - rect.top) * dpr;

    const cellSize = mergedConfig.cellSize;
    const radius = (cellSize / 2 - 1) * dpr;

    for (const [key, point] of pointPositionsRef.current) {
      if (key.includes(',')) {
        const [px, py] = key.split(',').map(Number);
        if (!isNaN(px) && !isNaN(py) && px > 100) {
          const distance = Math.sqrt(Math.pow(clickX - px, 2) + Math.pow(clickY - py, 2));
          if (distance <= radius * 1.5) {
            onPointClick(point);
            return;
          }
        }
      }
    }
  }, [onPointClick, data, mergedConfig]);

  // 悬停事件
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPointHover || !data?.points.length) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mouseX = (e.clientX - rect.left) * dpr;
    const mouseY = (e.clientY - rect.top) * dpr;

    const cellSize = mergedConfig.cellSize;
    const radius = (cellSize / 2 - 1) * dpr;

    for (const [key, point] of pointPositionsRef.current) {
      if (key.includes(',')) {
        const [px, py] = key.split(',').map(Number);
        if (!isNaN(px) && !isNaN(py) && px > 100) {
          const distance = Math.sqrt(Math.pow(mouseX - px, 2) + Math.pow(mouseY - py, 2));
          if (distance <= radius * 1.5) {
            onPointHover(point);
            canvas.style.cursor = 'pointer';
            return;
          }
        }
      }
    }

    onPointHover(null);
    canvas.style.cursor = 'default';
  }, [onPointHover, data, mergedConfig]);

  const handleCanvasMouseLeave = useCallback(() => {
    if (onPointHover) {
      onPointHover(null);
    }
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
  }, [onPointHover]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        className={className}
        width={canvasPixelSize.width}
        height={canvasPixelSize.height}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        style={{
          display: 'block',
          width: canvasPixelSize.styleWidth,
          height: canvasPixelSize.styleHeight,
          cursor: onPointClick ? 'pointer' : 'default',
          ...style,
        }}
      />
    </div>
  );
};

export default BigRoadCanvas;
