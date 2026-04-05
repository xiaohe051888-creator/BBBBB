/**
 * 走势图类型定义 - 百家乐分析预测系统
 * 与后端 road_engine.py 数据结构完全对齐
 */

/** 单个走势图上的点（对应后端 RoadPoint） */
export interface RoadPoint {
  game_number: number;
  column: number;
  row: number;
  value: string;           // '庄' | '闲' | '延' | '转'
  is_new_column: boolean;
  error_id: string | null;
}

/** 单条路的完整数据（对应后端 RoadData） */
export interface RoadData {
  road_type: string;
  display_name: string;
  points: RoadPoint[];
  max_columns: number;
  max_rows: number;
}

/** 五路完整数据（对应后端 FiveRoadResult） */
export interface FiveRoadData {
  big_road: RoadData;       // 大路
  bead_road: RoadData;      // 珠盘路
  big_eye_boy: RoadData;    // 大眼仔路
  small_road: RoadData;     // 小路
  cockroach_road: RoadData; // 螳螂路
}

/** 路的类型 */
export type RoadType = 'big_road' | 'bead_road' | 'big_eye_boy' | 'small_road' | 'cockroach_road';

/** 路的中文名映射 */
export const ROAD_DISPLAY_NAMES: Record<RoadType, string> = {
  big_road: '大路',
  bead_road: '珠盘路',
  big_eye_boy: '大眼仔路',
  small_road: '小路',
  cockroach_road: '螳螂路',
};

/** 颜色配置 - 与后端和CSS一致 */
export const ROAD_COLORS = {
  banker: '#ff4d4f',       // 庄 - 红
  player: '#1890ff',       // 闲 - 蓝
  tie: '#52c41a',          // 和 - 绿
  derived_red: '#ff4d4f',  // 派生路-延(红/重复)
  derived_blue: '#1890ff', // 派生路-转(蓝/转折)
  background: '#0d1117',   // 背景
  gridLine: '#21262d',     // 网格线
  text: '#8b949e',         // 文字
  textLight: '#c9d1d9',    // 浅色文字
  errorMark: '#faad14',     // 错误标记-黄
} as const;

/** Canvas渲染配置 */
export interface RoadCanvasConfig {
  cellSize: number;          // 单元格大小(px)
  cellGap: number;           // 单元格间距(px)
  padding: number;           // 内边距(px)
  borderRadius: number;      // 圆角(px)
  fontSize: number;          // 字体大小(px)
  showCoordinates: boolean;  // 是否显示坐标
  showGrid: boolean;         // 是否显示网格线
  animateNewPoint: boolean;  // 是否启用新点动画
}

/** 默认大路配置 */
export const BIG_ROAD_CONFIG: RoadCanvasConfig = {
  cellSize: 28,
  cellGap: 3,
  padding: 12,
  borderRadius: 5,
  fontSize: 11,
  showCoordinates: false,
  showGrid: true,
  animateNewPoint: true,
};

/** 默认珠盘路配置 */
export const BEAD_ROAD_CONFIG: RoadCanvasConfig = {
  cellSize: 22,
  cellGap: 2,
  padding: 8,
  borderRadius: 4,
  fontSize: 9,
  showCoordinates: false,
  showGrid: true,
  animateNewPoint: false,
};

/** 默认派生路配置（大眼仔/小路/螳螂） */
export const DERIVED_ROAD_CONFIG: RoadCanvasConfig = {
  cellSize: 20,
  cellGap: 2,
  padding: 6,
  borderRadius: 3,
  fontSize: 8,
  showCoordinates: false,
  showGrid: true,
  animateNewPoint: false,
};
