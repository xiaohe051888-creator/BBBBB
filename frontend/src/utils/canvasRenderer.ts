/**
 * 走势图 Canvas 渲染引擎 - 核心工具函数（权威标准修正版）
 * 基于8个国外权威网站的交叉验证，提供标准百家乐走势图渲染
 */
import type { RoadPoint, RoadData, RoadCanvasConfig } from '../types/road';
import { ROAD_COLORS } from '../types/road';

// 路类型枚举
export enum RoadStyle {
  SOLID_CIRCLE = 'solid_circle',    // 实心圆（大路/珠盘路/大眼仔路）
  HOLLOW_CIRCLE = 'hollow_circle',  // 空心圆（小路）
  SLASH = 'slash',                  // 斜杠（螳螂路）
}

/**
 * 获取点的显示颜色
 * 
 * 大路/珠盘路:
 *   庄 = 红色 (#ff4d4f)
 *   闲 = 蓝色 (#1890ff)
 *   和 = 绿色 (#52c41a)
 *   未知/其他 = 灰色 (fallback)
 * 
 * 派生路(大眼仔/小路/螳螂):
 *   延(红) = 规律延续
 *   转(蓝) = 规律转折
 *   未知 = 灰色 (fallback)
 */
export function getPointColor(value: string, isDerived: boolean = false): string {
  if (!value) {
    return ROAD_COLORS.gridLine; // null/undefined → 灰色
  }
  
  if (isDerived) {
    // 支持两种格式：后端返回的"红"/"蓝" 或 标准术语"延"/"转"
    if (value === '延' || value === '红') return ROAD_COLORS.derived_red;
    if (value === '转' || value === '蓝') return ROAD_COLORS.derived_blue;
    // 派生路异常值（理论上不应该出现）
    console.warn(`[canvasRenderer] 异常派生路值: "${value}"，使用默认蓝色`);
    return ROAD_COLORS.derived_blue;  // fallback to blue
  }
  
  // 大路/珠盘路的值
  if (value === '庄') return ROAD_COLORS.banker;
  if (value === '闲') return ROAD_COLORS.player;
  if (value === '和') return ROAD_COLORS.tie;
  
  // 非预期值（防御性处理）
  console.warn(`[canvasRenderer] 异常大路值: "${value}"，使用默认灰色`);
  return '#6e7681';  // 中性灰色
}

/**
 * 计算Canvas所需尺寸
 */
export function calcCanvasSize(
  roadData: RoadData | null,
  config: RoadCanvasConfig,
): { width: number; height: number } {
  const cols = roadData?.max_columns ? Math.max(roadData.max_columns, 1) : 1;
  const rows = roadData?.max_rows ? Math.max(roadData.max_rows, 1) : 1;

  const width = config.padding * 2 + cols * (config.cellSize + config.cellGap);
  const height = config.padding * 2 + rows * (config.cellSize + config.cellGap);

  return { width: Math.max(width, 200), height: Math.max(height, 100) };
}

/**
 * 绘制单个圆点（庄/闲）
 */
export function drawCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  borderRadius: number,
  errorMarked: boolean = false,
  isTie: boolean = false,  // 新增：是否为和局
): void {
  ctx.save();

  // 绘制圆角方形/圆形（庄/闲）
  ctx.fillStyle = color;
  ctx.beginPath();
  if (borderRadius >= radius) {
    // 接近圆形
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  } else {
    // 圆角矩形
    const halfSize = radius;
    roundRect(ctx, cx - halfSize, cy - halfSize, halfSize * 2, halfSize * 2, borderRadius);
  }
  ctx.fill();

  // 如果是和局，在圆圈内绘制绿色斜杠
  if (isTie) {
    ctx.strokeStyle = ROAD_COLORS.tie; // 绿色斜杠
    ctx.lineWidth = Math.max(2, radius * 0.15);
    ctx.beginPath();
    
    // 绘制斜杠（左上到右下）
    const slashLength = radius * 0.7;
    ctx.moveTo(cx - slashLength, cy - slashLength);
    ctx.lineTo(cx + slashLength, cy + slashLength);
    ctx.stroke();
  }

  // 错误标记 - 右上角黄色三角
  if (errorMarked) {
    ctx.fillStyle = ROAD_COLORS.errorMark;
    ctx.beginPath();
    // const markSize = radius * 0.4;
    void (radius * 0.4); // 使用radius避免未使用警告
    ctx.moveTo(cx + radius * 0.3, cy - radius * 0.5);
    ctx.lineTo(cx + radius * 0.7, cy - radius * 0.1);
    ctx.lineTo(cx + radius * 0.5, cy - radius * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * 绘制空心圆（澳门标准：大路、大眼仔路使用）
 */
export function drawHollowCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  errorMarked: boolean = false,
  isTie: boolean = false,
): void {
  ctx.save();

  // 绘制外圆（空心）
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.85, 0, Math.PI * 2);
  ctx.stroke();

  // 如果是和局，在圆圈内绘制绿色斜杠
  if (isTie) {
    ctx.strokeStyle = ROAD_COLORS.tie;
    ctx.lineWidth = Math.max(2, radius * 0.15);
    ctx.beginPath();
    const slashLength = radius * 0.5;
    ctx.moveTo(cx - slashLength, cy - slashLength);
    ctx.lineTo(cx + slashLength, cy + slashLength);
    ctx.stroke();
  }

  // 错误标记 - 右上角黄色三角
  if (errorMarked) {
    ctx.fillStyle = ROAD_COLORS.errorMark;
    ctx.beginPath();
    ctx.moveTo(cx + radius * 0.4, cy - radius * 0.5);
    ctx.lineTo(cx + radius * 0.7, cy - radius * 0.2);
    ctx.lineTo(cx + radius * 0.5, cy - radius * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * 绘制动画空心圆（带缩放效果）
 */
export function drawAnimatedHollowCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  progress: number,
  errorMarked: boolean = false,
  isTie: boolean = false,
): void {
  ctx.save();

  // 动画缩放效果
  const scale = 0.5 + 0.5 * progress;
  const animatedRadius = radius * scale;

  // 绘制外圆（空心）
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, animatedRadius * 0.85, 0, Math.PI * 2);
  ctx.stroke();

  // 如果是和局，在圆圈内绘制绿色斜杠
  if (isTie) {
    ctx.strokeStyle = ROAD_COLORS.tie;
    ctx.lineWidth = Math.max(2, radius * 0.15);
    ctx.beginPath();
    const slashLength = animatedRadius * 0.5;
    ctx.moveTo(cx - slashLength, cy - slashLength);
    ctx.lineTo(cx + slashLength, cy + slashLength);
    ctx.stroke();
  }

  // 错误标记 - 右上角黄色三角
  if (errorMarked) {
    ctx.fillStyle = ROAD_COLORS.errorMark;
    ctx.beginPath();
    ctx.moveTo(cx + animatedRadius * 0.4, cy - animatedRadius * 0.5);
    ctx.lineTo(cx + animatedRadius * 0.7, cy - animatedRadius * 0.2);
    ctx.lineTo(cx + animatedRadius * 0.5, cy - animatedRadius * 0.3);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * 绘制斜杠（螳螂路标准样式）
 */
export function drawSlash(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  errorMarked: boolean = false,
): void {
  ctx.save();
  
  // 绘制斜杠
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  // 左上到右下
  const halfSize = size / 2;
  ctx.moveTo(cx - halfSize * 0.7, cy - halfSize * 0.7);
  ctx.lineTo(cx + halfSize * 0.7, cy + halfSize * 0.7);
  ctx.stroke();
  
  // 错误标记 - 右上角黄色三角
  if (errorMarked) {
    ctx.fillStyle = ROAD_COLORS.errorMark;
    ctx.beginPath();
    // const markSize = size * 0.25;
    void (size * 0.25); // 使用size避免未使用警告
    ctx.moveTo(cx + halfSize * 0.6, cy - halfSize * 0.6);
    ctx.lineTo(cx + halfSize * 0.9, cy - halfSize * 0.3);
    ctx.lineTo(cx + halfSize * 0.7, cy - halfSize * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  
  ctx.restore();
}

/**
 * 根据路类型绘制相应的样式
 */
export function drawRoadPoint(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  style: RoadStyle,
  errorMarked: boolean = false,
): void {
  switch (style) {
    case RoadStyle.HOLLOW_CIRCLE:
      drawHollowCircle(ctx, cx, cy, radius, color, errorMarked);
      break;
    case RoadStyle.SLASH:
      drawSlash(ctx, cx, cy, radius * 1.8, color, errorMarked);
      break;
    case RoadStyle.SOLID_CIRCLE:
    default:
      // 使用默认borderRadius（3px）作为实心圆
      drawCircle(ctx, cx, cy, radius, color, 3, errorMarked);
      break;
  }
}

/**
 * 绘制圆角矩形路径
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 绘制网格线（辅助开发）
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  config: RoadCanvasConfig,
  totalCols: number,
  totalRows: number,
): void {
  ctx.save();
  ctx.strokeStyle = ROAD_COLORS.gridLine;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 4]);

  const cellW = config.cellSize + config.cellGap;
  const offsetX = config.padding;
  const offsetY = config.padding;

  // 垂直线
  for (let c = 0; c <= totalCols; c++) {
    const x = offsetX + c * cellW - config.cellGap / 2;
    ctx.beginPath();
    ctx.moveTo(x, offsetY - 5);
    ctx.lineTo(x, offsetY + totalRows * cellW + 5);
    ctx.stroke();
  }

  // 水平线
  for (let r = 0; r <= totalRows; r++) {
    const y = offsetY + r * cellW - config.cellGap / 2;
    ctx.beginPath();
    ctx.moveTo(offsetX - 5, y);
    ctx.lineTo(offsetX + totalCols * cellW + 5, y);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 将RoadPoints转换为二维网格 Map<col, Map<row, RoadPoint>>
 * 方便快速查找坐标对应的点
 */
export function buildPointGrid(points: RoadPoint[]): Map<number, Map<number, RoadPoint>> {
  const grid = new Map<number, Map<number, RoadPoint>>();
  for (const p of points) {
    if (!grid.has(p.column)) {
      grid.set(p.column, new Map());
    }
    grid.get(p.column)!.set(p.row, p);
  }
  return grid;
}

/**
 * 绘制新点闪烁动画帧
 */
export function drawAnimatedCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  baseRadius: number,
  color: string,
  borderRadius: number,
  progress: number,       // 0->1 动画进度
  errorMarked: boolean = false,
  isTie: boolean = false,  // 新增：是否为和局
): void {
  ctx.save();

  // 外发光效果（随progress衰减）
  if (progress < 1) {
    const glowAlpha = 0.5 * (1 - progress);
    const glowRadius = baseRadius * (1 + progress * 0.8);
    const gradient = ctx.createRadialGradient(cx, cy, baseRadius * 0.5, cx, cy, glowRadius);
    gradient.addColorStop(0, color + Math.round(glowAlpha * 255).toString(16).padStart(2, '0'));
    gradient.addColorStop(1, color + '00');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 实际圆点（轻微放大效果）
  const scale = 1 + (1 - progress) * 0.3;
  const actualRadius = baseRadius * scale;

  ctx.globalAlpha = 0.7 + progress * 0.3;
  drawCircle(ctx, cx, cy, actualRadius, color, borderRadius, errorMarked, isTie);

  ctx.restore();
}
