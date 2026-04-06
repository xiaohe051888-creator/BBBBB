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

interface FiveRoadChartProps {
  /** API返回的五路数据（中文键）或标准 FiveRoadData（英文键） */
  data: Record<string, { display_name: string; max_columns: number; max_rows: number; points: RoadData['points'] }> | null;
  loading?: boolean;
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
}) => {
  const [displayData, setDisplayData] = useState<FiveRoadData | null>(data ? normalizeFiveRoadData(data) : null);

  useEffect(() => {
    if (data) {
      setDisplayData(normalizeFiveRoadData(data));
    } else {
      setDisplayData(null);
    }
  }, [data]);

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
