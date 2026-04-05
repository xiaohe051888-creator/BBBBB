/**
 * 五路走势图容器组件
 * 统一管理5个Canvas子组件，提供数据加载和布局
 */
import React, { useState, useEffect } from 'react';
import { Empty } from 'antd';
import BigRoadCanvas from './BigRoadCanvas';
import BeadRoadCanvas from './BeadRoadCanvas';
import DerivedRoadCanvas from './DerivedRoadCanvas';
import type { FiveRoadData, RoadData, RoadPoint } from '../../types/road';

/** 模拟数据生成器（用于开发和演示） */
export function generateMockFiveRoadData(gameCount: number = 30): FiveRoadData {
  const results: string[] = [];
  for (let i = 0; i < gameCount; i++) {
    const rand = Math.random();
    if (rand < 0.44) results.push('庄');
    else if (rand < 0.88) results.push('闲');
    else results.push('和');
  }

  // 大路算法
  const bigRoadPoints: RoadData['points'] = [];
  let column = 0, row = 0, prevValue: string | null = null;
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result === '和') continue;

    let isNewCol = false;
    if (prevValue === null) {
      isNewCol = true;
    } else if (result === prevValue) {
      row += 1;
      if (row >= 6) { row = 5; column += 1; isNewCol = true; }
    } else {
      column += 1; row = 0; isNewCol = true;
    }

    bigRoadPoints.push({
      game_number: i + 1,
      column,
      row,
      value: result,
      is_new_column: isNewCol,
      error_id: null,
    });
    prevValue = result;
  }

  // 珠盘路算法
  const beadPoints: RoadData['points'] = [];
  let validIdx = 0;
  for (let i = 0; i < results.length; i++) {
    if (results[i] === '和') continue;
    beadPoints.push({
      game_number: i + 1,
      column: validIdx % 14,
      row: Math.floor(validIdx / 14) % 6,
      value: results[i],
      is_new_column: validIdx > 0 && validIdx % 14 === 0,
      error_id: null,
    });
    validIdx++;
  }

  // 派生路算法
  function calcDerived(offset: number): RoadData['points'] {
    const points: RoadData['points'] = [];
    if (bigRoadPoints.length < offset + 1) return points;

    const colMap = new Map<number, RoadPoint[]>();
    for (const p of bigRoadPoints) {
      if (!colMap.has(p.column)) colMap.set(p.column, []);
      colMap.get(p.column)!.push(p);
    }

    const sortedCols = Array.from(colMap.keys()).sort((a, b) => a - b);
    let dCol = 0, dRow = 0, prevVal: string | null = null;

    for (let ci = offset; ci < sortedCols.length; ci++) {
      const curCol = sortedCols[ci];
      const prevCol = sortedCols[ci - offset];
      const curFirst = colMap.get(curCol)?.[0];
      const prevList = colMap.get(prevCol);
      
      if (!curFirst || !prevList) continue;

      const derivedVal = curFirst.row < prevList.length ? '延' : '转';

      let isNewCol = false;
      if (prevVal === null) isNewCol = true;
      else if (derivedVal !== prevVal) { dCol++; dRow = 0; isNewCol = true; }
      else { dRow++; }

      points.push({
        game_number: curFirst.game_number,
        column: dCol,
        row: dRow,
        value: derivedVal,
        is_new_column: isNewCol,
        error_id: null,
      });
      prevVal = derivedVal;
    }
    return points;
  }

  function getMaxDims(points: RoadData['points']) {
    if (!points.length) return { max_columns: 0, max_rows: 0 };
    return {
      max_columns: Math.max(...points.map((p: { column: number; row: number }) => p.column)) + 1,
      max_rows: Math.max(...points.map((p: { column: number; row: number }) => p.row)) + 1,
    };
  }

  const bigDims = getMaxDims(bigRoadPoints);
  const beadDims = { max_columns: 14, max_rows: Math.min(6, Math.ceil(beadPoints.length / 14)) };

  return {
    big_road: { road_type: 'big_road', display_name: '大路', points: bigRoadPoints, ...bigDims },
    bead_road: { road_type: 'bead_road', display_name: '珠盘路', points: beadPoints, ...beadDims },
    big_eye_boy: { road_type: 'big_eye_boy', display_name: '大眼仔路', points: calcDerived(1), ...getMaxDims(calcDerived(1)) },
    small_road: { road_type: 'small_road', display_name: '小路', points: calcDerived(2), ...getMaxDims(calcDerived(2)) },
    cockroach_road: { road_type: 'cockroach_road', display_name: '螳螂路', points: calcDerived(3), ...getMaxDims(calcDerived(3)) },
  };
}

interface FiveRoadChartProps {
  /** API返回的五路数据（中文键）或标准 FiveRoadData（英文键） */
  data: Record<string, { display_name: string; max_columns: number; max_rows: number; points: RoadData['points'] }> | null;
  loading?: boolean;
  /** 是否在无数据时使用模拟数据展示（开发模式） */
  useMockData?: boolean;
  /** 模拟数据局数 */
  mockGameCount?: number;
}

/** 将中英文键的五路数据统一转换为 FiveRoadData 格式 */
function normalizeFiveRoadData(
  data: Record<string, { display_name: string; max_columns: number; max_rows: number; points: RoadData['points'] }>
): FiveRoadData {
  const keyMap: Record<string, keyof FiveRoadData> = {
    'big_road': 'big_road',
    'bead_road': 'bead_road', 
    'big_eye_boy': 'big_eye_boy',
    'small_road': 'small_road',
    'cockroach_road': 'cockroach_road',
    '大路': 'big_road',
    '珠盘路': 'bead_road',
    '大眼仔路': 'big_eye_boy',
    '小路': 'small_road',
    '螳螂路': 'cockroach_road',
  };
  
  const result: any = {};
  for (const [key, value] of Object.entries(data)) {
    const mappedKey = keyMap[key];
    if (mappedKey) {
      result[mappedKey] = {
        road_type: mappedKey,
        display_name: value.display_name,
        max_columns: value.max_columns,
        max_rows: value.max_rows,
        points: value.points,
      };
    }
  }
  
  // 确保所有5个键都存在
  for (const key of ['big_road', 'bead_road', 'big_eye_boy', 'small_road', 'cockroach_road'] as const) {
    if (!result[key]) {
      result[key] = { road_type: key, display_name: '', points: [], max_columns: 0, max_rows: 0 };
    }
  }
  
  return result as FiveRoadData;
}

const FiveRoadChart: React.FC<FiveRoadChartProps> = ({
  data,
  loading = false,
  useMockData = false,
  mockGameCount = 35,
}) => {
  const [displayData, setDisplayData] = useState<FiveRoadData | null>(data ? normalizeFiveRoadData(data) : null);

  useEffect(() => {
    if (data) {
      setDisplayData(normalizeFiveRoadData(data));
    } else if (useMockData) {
      setDisplayData(generateMockFiveRoadData(mockGameCount));
    } else {
      setDisplayData(null);
    }
  }, [data, useMockData, mockGameCount]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: '#0a1628', borderRadius: 8, padding: 12, minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#8b949e' }}>加载中...</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ background: '#0a1628', borderRadius: 8, padding: 8, minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#8b949e' }}>加载中...</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!displayData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: '#0a1628', borderRadius: 8, padding: 12, minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="大路 - 等待数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {['珠盘路', '大眼仔路', '小路', '螳螂路'].map(name => (
            <div key={name} style={{ background: '#0a1628', borderRadius: 8, padding: 8, minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Empty description={name} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 大路 - 占满顶部 */}
      <div style={{
        background: '#0a1628',
        borderRadius: 8,
        padding: 10,
        minHeight: 180,
        overflow: 'auto',
      }}>
        <div style={{ 
          fontSize: 11, 
          color: '#8b949e', 
          marginBottom: 6,
          fontWeight: 600,
        }}>📊 大路 Big Road ({displayData.big_road.points.length}点)</div>
        <BigRoadCanvas data={displayData.big_road} width={undefined} height={180} />
      </div>

      {/* 下方4路 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* 珠盘路 */}
        <div style={{ background: '#0a1628', borderRadius: 8, padding: 8, minHeight: 120, overflow: 'hidden' }}>
          <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 4, fontWeight: 600 }}>
            🔴 珠盘路 Bead
          </div>
          <BeadRoadCanvas data={displayData.bead_road} height={110} />
        </div>

        {/* 大眼仔路 */}
        <div style={{ background: '#0a1628', borderRadius: 8, padding: 8, minHeight: 120, overflow: 'hidden' }}>
          <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 4, fontWeight: 600 }}>
            👁️ 大眼仔路 BigEye (offset=1)
          </div>
          <DerivedRoadCanvas data={displayData.big_eye_boy} height={110} />
        </div>

        {/* 小路 */}
        <div style={{ background: '#0a1628', borderRadius: 8, padding: 8, minHeight: 120, overflow: 'hidden' }}>
          <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 4, fontWeight: 600 }}>
            📐 小路 Small (offset=2)
          </div>
          <DerivedRoadCanvas data={displayData.small_road} height={110} />
        </div>

        {/* 螳螂路 */}
        <div style={{ background: '#0a1628', borderRadius: 8, padding: 8, minHeight: 120, overflow: 'hidden' }}>
          <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 4, fontWeight: 600 }}>
            🦗 螳螂路 Cockroach (offset=3)
          </div>
          <DerivedRoadCanvas data={displayData.cockroach_road} height={110} />
        </div>
      </div>

      {/* 图例 */}
      <div style={{ 
        display: 'flex', 
        gap: 16, 
        justifyContent: 'center',
        padding: '6px 0',
        fontSize: 10,
        color: '#8b949e',
      }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ff4d4f', marginRight: 4 }} /> 庄/延</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#1890ff', marginRight: 4 }} /> 闲/转</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#faad14', marginRight: 4 }} /> 错误</span>
      </div>
    </div>
  );
};

export default FiveRoadChart;
