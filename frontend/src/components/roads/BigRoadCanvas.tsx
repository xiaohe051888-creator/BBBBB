/**
 * 大路图 (Big Road) Canvas 组件
 * 
 * 规则：
 * - 相同颜色一组最多6个，往下延伸
 * - 颜色变化必换列（column++, row=0）
 * - 每列最多6行（row: 0~5）
 * - 庄 = 红色圆, 闲 = 蓝色圆
 */
import React, { useRef, useEffect, useCallback } from 'react';
import type { RoadData, RoadCanvasConfig } from '../../types/road';
import { BIG_ROAD_CONFIG, ROAD_COLORS } from '../../types/road';
import {
  calcCanvasSize,
  getPointColor,
  drawCircle,
  drawGrid,
  buildPointGrid,
  drawAnimatedCircle,
} from '../../utils/canvasRenderer';

interface BigRoadCanvasProps {
  data: RoadData | null;
  config?: Partial<RoadCanvasConfig>;
  width?: number;       // 外部约束宽度
  height?: number;      // 外部约束高度
  className?: string;
  style?: React.CSSProperties;
}

const BigRoadCanvas: React.FC<BigRoadCanvasProps> = ({
  data,
  config: customConfig,
  width: externalWidth,
  height: externalHeight,
  className,
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const mergedConfig = { ...BIG_ROAD_CONFIG, ...customConfig };

  // 获取最新点的game_number，用于动画触发
  const lastGameNumber = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // 计算尺寸
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

    // 设置canvas实际尺寸（考虑设备像素比）
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = `${canvasWidth / dpr}px`;
    canvas.style.height = `${canvasHeight / dpr}px`;

    // 缩放上下文以匹配DPR
    ctx.scale(dpr, dpr);

    const displayWidth = canvasWidth / dpr;
    const displayHeight = canvasHeight / dpr;

    // 清空画布
    ctx.fillStyle = ROAD_COLORS.background;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    if (!data || !data.points.length) {
      // 绘制空状态
      ctx.fillStyle = '#30363d';
      ctx.font = `${mergedConfig.fontSize + 2}px -apple-system, "PingFang SC", sans-serif`;
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

    // 绘制网格
    if (mergedConfig.showGrid) {
      drawGrid(ctx, mergedConfig, totalCols, totalRows);
    }

    // 构建点网格用于快速查找
    const grid = buildPointGrid(data.points);

    // 检测是否有新点需要动画
    const hasNewPoint = data.points.length > 0 && 
      data.points[data.points.length - 1].game_number > lastGameNumber.current;
    
    if (hasNewPoint) {
      lastGameNumber.current = data.points[data.points.length - 1].game_number;
      startTimeRef.current = performance.now();
    }

    const elapsed = hasNewPoint ? performance.now() - startTimeRef.current : Infinity;
    const animProgress = Math.min(elapsed / 600, 1); // 600ms动画

    // 绘制每个点
    for (let col = 0; col < totalCols; col++) {
      const colPoints = grid.get(col);
      if (!colPoints) continue;

      for (const [row, point] of colPoints) {
        const x = padding + col * (cellSize + cellGap) + cellSize / 2;
        const y = padding + row * (cellSize + cellGap) + cellSize / 2;

        const color = getPointColor(point.value, false);
        const isLastPoint = point === data.points[data.points.length - 1];

        if (isLastPoint && hasNewPoint && animProgress < 1) {
          // 新点动画
          // 判断是否为和局：value === '和' 或者 is_tie === true
          const isTie = point.value === '和' || point.is_tie === true;
          drawAnimatedCircle(ctx, x, y, cellSize / 2 - 1, color, mergedConfig.borderRadius, animProgress, !!point.error_id, isTie);
        } else {
          // 判断是否为和局：value === '和' 或者 is_tie === true
          const isTie = point.value === '和' || point.is_tie === true;
          drawCircle(ctx, x, y, cellSize / 2 - 1, color, mergedConfig.borderRadius, !!point.error_id, isTie);
        }
      }
    }
  }, [data, mergedConfig, externalWidth, externalHeight]);

  useEffect(() => {
    draw();

    // 动画循环（仅当有新点时）
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
  }, [draw, data?.points.length]);

  // 窗口resize重绘
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

export default BigRoadCanvas;
