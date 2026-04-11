/**
 * 左侧面板组件
 */
import React from 'react';
import { Progress } from 'antd';
import { FiveRoadChart } from '../roads';
import { ChartIcon } from '../ui/Icons';
import { MAX_GAMES_PER_BOOT } from '../../utils/constants';
import type { FiveRoadsResponse } from '../../services/api';

interface LeftPanelProps {
  roadData: FiveRoadsResponse | null;
  systemState: { game_number?: number } | null;
  stats: { total_games?: number; accuracy?: number } | null;
  consecutiveErrors: number;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ roadData, systemState, stats, consecutiveErrors }) => {
  return (
    <div className="left-panel" style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 五路走势图 */}
      <div className="road-chart-card" style={{ minHeight: 420 }}>
        <div className="section-header">
          <span style={{ color: '#722ed1' }}><ChartIcon /></span>
          <span className="section-title">五路走势图</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
              大路 · 珠盘路 · 大眼仔路 · 小路 · 螳螂路
            </span>
          </div>
        </div>
        <div style={{ padding: '8px 12px 12px' }}>
          <FiveRoadChart data={roadData?.roads ?? null} />
        </div>
      </div>

      {/* 本靴进度 */}
      <div className="data-card">
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>本靴进度</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>第{systemState?.game_number || 0}局 / 预计50-70局</span>
          </div>
          <Progress
            percent={Math.min(100, ((systemState?.game_number || 0) / MAX_GAMES_PER_BOOT) * 100)}
            showInfo={false}
            strokeColor={{ '0%': '#1890ff', '50%': '#722ed1', '100%': '#ff4d4f' }}
            railColor="rgba(48,54,68,0.3)"
            size={['100%', 8]}
          />
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(82,196,26,0.05)', border: '1px solid rgba(82,196,26,0.1)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>总局数</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#73d13d' }}>{stats?.total_games || 0}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.1)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>准确率</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#ffd700' }}>{stats?.accuracy || 0}%</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(255,77,79,0.05)', border: '1px solid rgba(255,77,79,0.1)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>连续失准</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#ff7875' }}>{consecutiveErrors}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
