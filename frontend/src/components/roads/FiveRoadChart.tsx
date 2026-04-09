/**
 * 五路走势图容器组件
 * 
 * 布局规范:
 * ┌──────────────────────────────────────┐
 * │  大路 Big Road (全宽, 自适应高度)     │ ← 单独一行，最显眼
 * ├──────────────┬───────────────────────┤
 * │ 珠盘路 Bead   │ 大眼仔路 BigEye       │ ← 2×2网格
 * ├──────────────┼───────────────────────┤
 * │ 小路 Small   │ 螳螂路 Cockroach      │
 * ├──────────────┴───────────────────────┤
 * │  图例 (居中, 紧凑)                    │ ← 统一图例
 * └──────────────────────────────────────┘
 * 
 * 颜色规则:
 * - 大路/珠盘路: 庄=红(♦), 闲=蓝(♣), 和=绿(♠)
 * - 派生路: 红=延(规律延续), 蓝=转(规律转折) — 不代表庄闲！
 * - 错误标记: 黄色三角(▲)
 */
import React, { useMemo } from 'react';
import { Empty, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import BigRoadCanvas from './BigRoadCanvas';
import BeadRoadCanvas from './BeadRoadCanvas';
import DerivedRoadCanvas from './DerivedRoadCanvas';
import type { FiveRoadData, RoadData } from '../../types/road';
import { ROAD_COLORS, ROAD_RULES } from '../../types/road';

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
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // 使用useMemo替代useState + useEffect避免级联渲染问题
  const displayData = useMemo(() => {
    if (data) {
      return normalizeFiveRoadData(data);
    }
    return null;
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
      {/* ===== 大路 - 占满顶部（最重要的一条路）===== */}
      <div style={{
        background: ROAD_COLORS.background,
        borderRadius: 8,
        padding: 10,
        minHeight: 200,
        overflow: 'auto',
        border: '1px solid #21262d',
      }}>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12, 
          color: '#8b949e', 
          marginBottom: 8,
          fontWeight: 600,
        }}>
          <span>
            <span style={{ marginRight: 6 }}>📊</span>
            <span>大路 Big Road</span>
            {displayData?.big_road && (
              <span style={{ fontWeight: 400, color: '#6e7681', marginLeft: 8, fontSize: 11 }}>
                ({displayData.big_road.points.length}点 · {displayData.big_road.max_columns}列×{displayData.big_road.max_rows}行)
                {displayData.big_road.max_rows >= ROAD_RULES.MAX_ROWS_PER_COLUMN && (
                  <Tooltip title="大路已达到每列最大行数限制，后续同色结果将折到右侧新列">
                    <InfoCircleOutlined style={{ marginLeft: 4, color: '#d29922' }} />
                  </Tooltip>
                )}
              </span>
            )}
          </span>
          <span style={{ fontSize: 11, fontWeight: 400, color: '#484f58' }}>
            规则: 同色纵向排列(最多{ROAD_RULES.MAX_ROWS_PER_COLUMN}个) · 换色换新列
          </span>
        </div>
        <BigRoadCanvas data={displayData.big_road} width={undefined} height={200} />
      </div>

      {/* ===== 下方4路（2×2网格布局）===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* 珠盘路 */}
        <div style={{ background: ROAD_COLORS.background, borderRadius: 8, padding: 8, minHeight: 130, overflow: 'hidden', border: '1px solid #21262d' }}>
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            <span>🔴 珠盘路 Bead</span>
            <span style={{ fontSize: 10, fontWeight: 400, color: '#484f58', marginLeft: 'auto' }}>
              {ROAD_RULES.BEAD_COLUMNS}×{ROAD_RULES.BEAD_MAX_ROWS}固定网格
            </span>
          </div>
          <BeadRoadCanvas data={displayData.bead_road} height={110} />
        </div>

        {/* 大眼仔路 */}
        <div style={{ background: ROAD_COLORS.background, borderRadius: 8, padding: 8, minHeight: 130, overflow: 'hidden', border: '1px solid #21262d' }}>
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            <span>👁️ 大眼仔路 BigEye</span>
            <span style={{ fontSize: 10, fontWeight: 400, color: '#484f58', marginLeft: 'auto' }}>
              offset=1 · {displayData.big_eye_boy?.points.length || 0}点
            </span>
          </div>
          <DerivedRoadCanvas data={displayData.big_eye_boy} height={110} />
        </div>

        {/* 小路 */}
        <div style={{ background: ROAD_COLORS.background, borderRadius: 8, padding: 8, minHeight: 130, overflow: 'hidden', border: '1px solid #21262d' }}>
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            <span>📐 小路 Small</span>
            <span style={{ fontSize: 10, fontWeight: 400, color: '#484f58', marginLeft: 'auto' }}>
              offset=2 · {displayData.small_road?.points.length || 0}点
            </span>
          </div>
          <DerivedRoadCanvas data={displayData.small_road} height={110} />
        </div>

        {/* 螳螂路 */}
        <div style={{ background: ROAD_COLORS.background, borderRadius: 8, padding: 8, minHeight: 130, overflow: 'hidden', border: '1px solid #21262d' }}>
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            <span>🦗 螳螂路 Cockroach</span>
            <span style={{ fontSize: 10, fontWeight: 400, color: '#484f58', marginLeft: 'auto' }}>
              offset=3 · {displayData.cockroach_road?.points.length || 0}点
            </span>
          </div>
          <DerivedRoadCanvas data={displayData.cockroach_road} height={110} />
        </div>
      </div>

      {/* ===== 图例说明（统一、清晰）===== */}
      <div style={{ 
        display: 'flex', 
        gap: 20, 
        justifyContent: 'center',
        padding: '8px 12px',
        background: '#0d1117',
        borderRadius: 6,
        border: '1px solid #21262d',
        flexWrap: 'wrap',
        fontSize: 11,
      }}>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: ROAD_COLORS.banker, marginRight: 5, verticalAlign: 'middle' }} /> 
          庄(Banker)
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: ROAD_COLORS.player, marginRight: 5, verticalAlign: 'middle' }} /> 
          闲(Player)
        </span>
        <span style={{ borderLeft: '1px solid #30363d', paddingLeft: 16 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: ROAD_COLORS.derived_red, marginRight: 5, verticalAlign: 'middle' }} /> 
          延(Red)
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%,', background: ROAD_COLORS.derived_blue, marginRight: 5, verticalAlign: 'middle' }} /> 
          转(Blue)
        </span>
        <span style={{ borderLeft: '1px solid #30363d', paddingLeft: 16 }}>
          <span style={{ display: 'inline-block', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '8px solid ' + ROAD_COLORS.errorMark, marginRight: 5, verticalAlign: 'middle' }} /> 
          错误
        </span>
      </div>
    </div>
  );
};

export default FiveRoadChart;
