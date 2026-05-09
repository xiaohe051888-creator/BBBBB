import React, { useMemo, useEffect, useRef } from 'react';
import type { SingleRoadData } from '../../services/api';
import BeadRoadCanvas from './BeadRoadCanvas';
import BigRoadCanvas from './BigRoadCanvas';
import DerivedRoadCanvas from './DerivedRoadCanvas';
import { calculateRoadHeight } from '../../types/road';
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
 * 五路走势图组件
 *
 * 当前移动端规则：
 * - 五条路全部独立成行
 * - 每条路卡片占满整行宽度
 * - 通过画布尺寸和 gap 收紧密度，而不是并排拼卡
 */
export const FiveRoadChart: React.FC<FiveRoadChartProps> = React.memo(({ data }) => {
  // 标题栏高度
  const HEADER_HEIGHT = 32;
  
  // 基础格子配置
  const BASE_CELL_SIZE = 20; // 基础格子大小
  const CELL_GAP = 1;
  const PADDING = 6;
  

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
  const beadRoadScrollRef = useRef<HTMLDivElement>(null);
  const bigEyeScrollRef = useRef<HTMLDivElement>(null);
  const smallScrollRef = useRef<HTMLDivElement>(null);
  const cockroachScrollRef = useRef<HTMLDivElement>(null);

  // 数据长度 refs（用于检测新数据）
  const prevLengths = useRef({
    big: 0,
    bead: 0,
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

    scrollToLatest(beadRoadScrollRef, roads.bead?.points.length || 0, prevLengths.current.bead);
    prevLengths.current.bead = roads.bead?.points.length || 0;

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

  const beadConfig: RoadCanvasConfig = useMemo(() => ({
    ...baseConfig,
    cellSize: 28,
    fontSize: 12,
  }), [baseConfig]);

  // 计算各路高度（6格）- 使用minHeight确保不被压缩
  const roadHeight = useMemo(() => {
    return calculateRoadHeight(baseConfig);
  }, [baseConfig]);

  const renderRoadCard = (
    title: string,
    scrollRef: React.RefObject<HTMLDivElement | null>,
    content: React.ReactNode,
    cardClassName?: string,
  ) => (
    <div className={cardClassName ? `roadmap-board-card ${cardClassName}` : 'roadmap-board-card'} style={{
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
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#e6edf3' }}>{title}</span>
      </div>
      <div
        ref={scrollRef as React.RefObject<HTMLDivElement>}
        style={{
          width: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        {content}
      </div>
    </div>
  );

  return (
      <div className="five-road-chart" style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '8px',
        background: '#0d1117',
      }}>
        {renderRoadCard(
          '大路',
          bigRoadScrollRef,
          <div style={{ height: `${roadHeight}px`, minWidth: 'max-content', paddingBottom: '8px' }}>
            {hasData.big ? (
              <BigRoadCanvas data={roads.big} config={baseConfig} />
            ) : (
              <EmptyState height={roadHeight} />
            )}
          </div>,
        )}

        {renderRoadCard(
          '珠盘路',
          beadRoadScrollRef,
          <div className="bead-road-responsive-shell" style={{
            overflow: 'hidden',
            height: `${roadHeight}px`,
            width: '100%',
          }}>
            <div style={{ height: `${roadHeight}px`, width: '100%' }}>
              {hasData.bead ? (
                <BeadRoadCanvas data={roads.bead} config={beadConfig} className="bead-road-responsive-canvas" />
              ) : (
                <EmptyState height={roadHeight} />
              )}
            </div>
          </div>,
          'bead-road-responsive-card',
        )}

        {renderRoadCard(
          '大眼仔路',
          bigEyeScrollRef,
          <div style={{ height: `${roadHeight}px`, minWidth: 'max-content', paddingBottom: '8px' }}>
            {hasData.bigEye ? (
              <DerivedRoadCanvas data={roads.bigEye} config={baseConfig} />
            ) : (
              <EmptyState height={roadHeight} />
            )}
          </div>,
        )}

        {renderRoadCard(
          '小路',
          smallScrollRef,
          <div style={{ height: `${roadHeight}px`, minWidth: 'max-content', paddingBottom: '8px' }}>
            {hasData.small ? (
              <DerivedRoadCanvas data={roads.small} config={baseConfig} />
            ) : (
              <EmptyState height={roadHeight} />
            )}
          </div>,
        )}

        {renderRoadCard(
          '螳螂路',
          cockroachScrollRef,
          <div style={{ height: `${roadHeight}px`, minWidth: 'max-content', paddingBottom: '8px' }}>
            {hasData.cockroach ? (
              <DerivedRoadCanvas data={roads.cockroach} config={baseConfig} />
            ) : (
              <EmptyState height={roadHeight} />
            )}
          </div>,
        )}
      </div>
    );
});

export default FiveRoadChart;
