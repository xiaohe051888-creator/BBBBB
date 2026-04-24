/**
 * 五路走势图图例组件
 * 统一显示颜色规则和说明
 */
import React from 'react';
import { ROAD_COLORS } from '../../types/road';

interface RoadLegendProps {
  /** 是否显示派生路说明 */
  showDerived?: boolean;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 五路走势图图例组件
 */
const RoadLegend: React.FC<RoadLegendProps> = ({
  showDerived = true,
  style,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: 20,
        justifyContent: 'center',
        padding: '8px 12px',
        background: '#0d1117',
        borderRadius: 6,
        border: '1px solid #21262d',
        flexWrap: 'wrap',
        fontSize: 11,
        ...style,
      }}
    >
      {/* 庄闲颜色 */}
      <span>
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: ROAD_COLORS.banker,
            marginRight: 5,
            verticalAlign: 'middle',
          }}
        />
        庄(Banker)
      </span>
      <span>
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: ROAD_COLORS.player,
            marginRight: 5,
            verticalAlign: 'middle',
          }}
        />
        闲(Player)
      </span>

      {/* 派生路颜色 */}
      {showDerived && (
        <>
          <span style={{ borderLeft: '1px solid #30363d', paddingLeft: 16 }}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: ROAD_COLORS.derived_red,
                marginRight: 5,
                verticalAlign: 'middle',
              }}
            />
            延(Red)
          </span>
          <span>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: ROAD_COLORS.derived_blue,
                marginRight: 5,
                verticalAlign: 'middle',
              }}
            />
            转(Blue)
          </span>
        </>
      )}

      {/* 错误标记 */}
      <span style={{ borderLeft: '1px solid #30363d', paddingLeft: 16 }}>
        <span
          style={{
            display: 'inline-block',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderBottom: `8px solid ${ROAD_COLORS.errorMark}`,
            marginRight: 5,
            verticalAlign: 'middle',
          }}
        />
        错误
      </span>
    </div>
  );
};

export default RoadLegend;
