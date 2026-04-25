import React, { useMemo, useRef, useEffect, useState } from 'react';
import type { SingleRoadData } from '../../services/api';
import BeadRoadCanvas from './BeadRoadCanvas';
import BigRoadCanvas from './BigRoadCanvas';
import DerivedRoadCanvas from './DerivedRoadCanvas';
import type { RoadData, RoadCanvasConfig } from '../../types/road';

interface RoadDataMap {
  大路: SingleRoadData;
  珠盘路: SingleRoadData;
  大眼仔路: SingleRoadData;
  小路: SingleRoadData;
  螳螂路: SingleRoadData;
}

interface FiveRoadChartProps {
  data: RoadDataMap | null;
}

// 将 SingleRoadData 转换为 RoadData 格式
const toRoadData = (road: SingleRoadData | undefined, roadType: string): RoadData | null => {
  if (!road || !road.points || road.points.length === 0) return null;
  
  return {
    road_type: roadType,
    display_name: road.display_name,
    points: road.points.map(p => ({
      game_number: p.game_number,
      column: p.column,
      row: p.row,
      value: p.value,
      is_new_column: p.is_new_column,
      error_id: p.error_id,
      has_tie: p.has_tie,
      is_tie: p.is_tie,
    })),
    max_columns: road.max_columns,
    max_rows: road.max_rows,
  };
};

// 空状态组件 (移到外部)
const EmptyState = ({ height }: { height: number }) => (
  <div style={{
    width: '100%',
    height: `${height}px`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d1117',
    borderRadius: '4px',
  }}>
    <span style={{ color: '#8b949e', fontSize: '12px' }}>等待数据...</span>
  </div>
);

/**
 * 五路走势图组件 - 流式布局版
 * 
 * 核心原则：
 * - 所有路牌容器占满可用宽度
 * - 大路、大眼仔路、小路、螳螂路都是100%宽度
 * - 珠盘路固定比例，大眼仔路自适应剩余空间
 * - 小路和螳螂路各占50%
 * - 所有路都精确显示6格高度
 */
export const FiveRoadChart: React.FC<FiveRoadChartProps> = React.memo(({ data }) => {
  // 标题栏高度
  const HEADER_HEIGHT = 32;
  
  // 基础格子配置
  const BASE_CELL_SIZE = 20; // 基础格子大小
  const CELL_GAP = 2;
  const PADDING = 6;
  
  // 检测移动端
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 使用useMemo缓存计算结果
  const roads = useMemo(() => ({
    bead: toRoadData(data?.珠盘路, 'bead_road'),
    big: toRoadData(data?.大路, 'big_road'),
    bigEye: toRoadData(data?.大眼仔路, 'big_eye_road'),
    small: toRoadData(data?.小路, 'small_road'),
    cockroach: toRoadData(data?.螳螂路, 'cockroach_road'),
  }), [data]);

  const hasData = useMemo(() => ({
    bead: !!roads.bead && roads.bead.points.length > 0,
    big: !!roads.big && roads.big.points.length > 0,
    bigEye: !!roads.bigEye && roads.bigEye.points.length > 0,
    small: !!roads.small && roads.small.points.length > 0,
    cockroach: !!roads.cockroach && roads.cockroach.points.length > 0,
  }), [roads]);

  // 滚动容器 refs
  const bigRoadScrollRef = useRef<HTMLDivElement>(null);
  const bigEyeScrollRef = useRef<HTMLDivElement>(null);
  const smallScrollRef = useRef<HTMLDivElement>(null);
  const cockroachScrollRef = useRef<HTMLDivElement>(null);

  // 数据长度 refs（用于检测新数据）
  const prevLengths = useRef({
    big: 0,
    bigEye: 0,
    small: 0,
    cockroach: 0,
  });

  // 自动滚动到最新数据
  useEffect(() => {
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    const scrollToLatest = (
      ref: React.RefObject<HTMLDivElement | null>,
      currentLength: number,
      prevLength: number
    ) => {
      if (ref.current && currentLength > 0) {
        if (prevLength === 0 || currentLength > prevLength) {
          // 使用 setTimeout 确保子组件 Canvas 尺寸已更新并触发 DOM Reflow
          const tid = setTimeout(() => {
            if (ref.current) {
              ref.current.scrollLeft = ref.current.scrollWidth;
            }
          }, 50);
          timeoutIds.push(tid);
        }
      }
    };

    scrollToLatest(bigRoadScrollRef, roads.big?.points.length || 0, prevLengths.current.big);
    prevLengths.current.big = roads.big?.points.length || 0;

    scrollToLatest(bigEyeScrollRef, roads.bigEye?.points.length || 0, prevLengths.current.bigEye);
    prevLengths.current.bigEye = roads.bigEye?.points.length || 0;

    scrollToLatest(smallScrollRef, roads.small?.points.length || 0, prevLengths.current.small);
    prevLengths.current.small = roads.small?.points.length || 0;

    scrollToLatest(cockroachScrollRef, roads.cockroach?.points.length || 0, prevLengths.current.cockroach);
    prevLengths.current.cockroach = roads.cockroach?.points.length || 0;

    return () => {
      timeoutIds.forEach(clearTimeout);
    };
  }, [roads]);

  // 基础配置
  const baseConfig: RoadCanvasConfig = useMemo(() => ({
    cellSize: BASE_CELL_SIZE,
    cellGap: CELL_GAP,
    padding: PADDING,
    borderRadius: 4,
    fontSize: 10,
    showCoordinates: false,
    showGrid: true,
    animateNewPoint: true,
  }), []);

  // 计算各路高度（6格）- 使用minHeight确保不被压缩
  const roadHeight = useMemo(() => {
    return PADDING * 2 + 6 * (BASE_CELL_SIZE + CELL_GAP);
  }, []);

  // 滚动容器高度，减少预留空间，让滚动条显得更紧凑
  const scrollContainerHeight = useMemo(() => {
    return roadHeight + 6;
  }, [roadHeight]);

  // 使用内置配置计算珠盘路的精确尺寸（包含12列）
  const beadRoadWidth = useMemo(() => {
    return PADDING * 2 + 12 * (BASE_CELL_SIZE + CELL_GAP);
  }, []);

  // 计算各路总高度（含标题栏）- 使用minHeight
  const totalRowHeight = useMemo(() => {
    return scrollContainerHeight + HEADER_HEIGHT;
  }, [scrollContainerHeight]);

  return (
      <div style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '8px',
        background: '#0d1117',
      }}>
        {/* 第1排：大路（单独一行） */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#161b22',
          borderRadius: '8px',
          border: '1px solid #30363d',
          overflow: 'hidden',
          width: '100%',
        }}>
          <div style={{
            padding: '6px 12px',
            background: '#21262d',
            borderBottom: '1px solid #30363d',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            height: `${HEADER_HEIGHT}px`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e6edf3' }}>大路</span>
            <span style={{ fontSize: '11px', color: '#8b949e' }}>Big Road</span>
          </div>
          <div
              ref={bigRoadScrollRef}
              style={{
                width: '100%',
                overflowX: 'auto',
                overflowY: 'hidden',
              }}
            >
              <div style={{ height: `${roadHeight}px`, minWidth: 'max-content', paddingBottom: '8px' }}>
              {hasData.big ? (
                <BigRoadCanvas data={roads.big} config={baseConfig} />
              ) : (
                <EmptyState height={roadHeight} />
              )}
            </div>
          </div>
        </div>

        {/* 第2排：珠盘路 + 大眼仔路 */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          gap: '8px',
          width: '100%',
        }}>
          {/* 珠盘路 - 精确控制宽度 */}
          <div style={{
            flex: 'none', // 不允许伸缩，严格按照内部计算宽度
            width: `${beadRoadWidth}px`,
            display: 'flex',
            flexDirection: 'column',
            background: '#161b22',
            borderRadius: '8px',
            border: '1px solid #30363d',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '6px 12px',
              background: '#21262d',
              borderBottom: '1px solid #30363d',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: `${HEADER_HEIGHT}px`,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#e6edf3' }}>珠盘路</span>
              <span style={{ fontSize: '10px', color: '#8b949e' }}>Bead</span>
            </div>
            <div style={{
              overflow: 'hidden',
              height: `${roadHeight}px`,
              width: `${beadRoadWidth}px`,
            }}>
              <div style={{ height: `${roadHeight}px`, width: `${beadRoadWidth}px` }}>
                {hasData.bead ? (
                  <BeadRoadCanvas data={roads.bead} config={baseConfig} />
                ) : (
                  <EmptyState height={roadHeight} />
                )}
              </div>
            </div>
          </div>

          {/* 大眼仔路 - 占据剩余宽度 */}
          <div style={{
            flex: '1 1 400px',
            minWidth: '300px',
            display: 'flex',
            flexDirection: 'column',
            background: '#161b22',
            borderRadius: '8px',
            border: '1px solid #30363d',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '6px 12px',
              background: '#21262d',
              borderBottom: '1px solid #30363d',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: `${HEADER_HEIGHT}px`,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#e6edf3' }}>大眼仔路</span>
              <span style={{ fontSize: '10px', color: '#8b949e' }}>Big Eye</span>
            </div>
            <div
              ref={bigEyeScrollRef}
              style={{
                width: '100%',
                overflowX: 'auto',
                overflowY: 'hidden',
              }}
            >
              <div style={{ height: `${roadHeight}px`, minWidth: 'max-content', paddingBottom: '8px' }}>
                {hasData.bigEye ? (
                  <DerivedRoadCanvas data={roads.bigEye} config={baseConfig} />
                ) : (
                  <EmptyState height={roadHeight} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 第3排：小路（单独一行） */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#161b22',
          borderRadius: '8px',
          border: '1px solid #30363d',
          overflow: 'hidden',
          width: '100%',
        }}>
          <div style={{
            padding: '6px 12px',
            background: '#21262d',
            borderBottom: '1px solid #30363d',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            height: `${HEADER_HEIGHT}px`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#e6edf3' }}>小路</span>
            <span style={{ fontSize: '10px', color: '#8b949e' }}>Small</span>
          </div>
          <div
            ref={smallScrollRef}
            style={{
              width: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
            }}
          >
            <div style={{ height: `${roadHeight}px`, minWidth: 'max-content', paddingBottom: '8px' }}>
              {hasData.small ? (
                <DerivedRoadCanvas data={roads.small} config={baseConfig} />
              ) : (
                <EmptyState height={roadHeight} />
              )}
            </div>
          </div>
        </div>

        {/* 第4排：螳螂路 / 曱甴路（单独一行） */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#161b22',
          borderRadius: '8px',
          border: '1px solid #30363d',
          overflow: 'hidden',
          width: '100%',
        }}>
          <div style={{
            padding: '6px 12px',
            background: '#21262d',
            borderBottom: '1px solid #30363d',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            height: `${HEADER_HEIGHT}px`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#e6edf3' }}>螳螂路</span>
            <span style={{ fontSize: '10px', color: '#8b949e' }}>Cockroach</span>
          </div>
          <div
            ref={cockroachScrollRef}
            style={{
              width: '100%',
              overflowX: 'auto',
              overflowY: 'hidden',
            }}
          >
            <div style={{ height: `${roadHeight}px`, minWidth: 'max-content', paddingBottom: '8px' }}>
              {hasData.cockroach ? (
                <DerivedRoadCanvas data={roads.cockroach} config={baseConfig} />
              ) : (
                <EmptyState height={roadHeight} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
});

export default FiveRoadChart;
