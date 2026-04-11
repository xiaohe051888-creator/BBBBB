/**
 * 右侧面板组件
 */
import React, { useState } from 'react';
import { Button, Tag, Progress, Select, Switch, Space } from 'antd';
import { GameTable, BetTable, LogTable } from '../tables';
import { SmartReport, SmartAlertsPanel } from '../smart';
import { LOG_CATEGORIES } from '../../utils/constants';
import { BulbIcon, FileIcon, CoinIcon, FireIcon, UploadIcon, RobotIcon } from '../ui/Icons';
import type { SmartAlert, DataIntegrityIssue, AbnormalPattern } from '../../hooks/useSmartDetection';

interface RightPanelProps {
  tableId: string | undefined;
  games: unknown[];
  bets: unknown[];
  logs: unknown[];
  stats: { total_games?: number | null; accuracy?: number | null; hit_count?: number | null; miss_count?: number | null; balance?: number | null } | null;
  analysis: { banker_summary?: string | null; player_summary?: string | null; combined_summary?: string | null; confidence?: number | null; bet_tier?: string | null; prediction?: string | null } | null;
  aiAnalyzing: boolean;
  integrityIssues: DataIntegrityIssue[];
  abnormalPatterns: AbnormalPattern[];
  alerts: SmartAlert[];
  onDismissAlert: (id: string) => void;
  onNavigate: (path: string) => void;
  gamePage: number;
  betPage: number;
  onGamePageChange: (page: number) => void;
  onBetPageChange: (page: number) => void;
  gamesTotal: number;
  betsTotal: number;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  tableId, games, bets, logs, stats, analysis, aiAnalyzing, integrityIssues, abnormalPatterns, alerts,
  onDismissAlert, onNavigate, gamePage, betPage, onGamePageChange, onBetPageChange, gamesTotal, betsTotal,
}) => {
  const hasGameData = games.length > 0;
  const [logCategory, setLogCategory] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState(true);

  return (
    <div className="right-panel" style={{ flex: '1 1 500px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 智能分析 */}
      <div className="analysis-card" style={{ minHeight: 'auto' }}>
        <div className="section-header">
          <span style={{ color: '#fadb14' }}><BulbIcon /></span>
          <span className="section-title">智能分析</span>
          {analysis && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>置信度</span>
              <Progress type="circle" percent={(analysis.confidence || 0) * 100} size={34} format={() => `${((analysis.confidence || 0) * 100).toFixed(0)}%`} strokeColor={(analysis.confidence || 0) >= 0.7 ? '#52c41a' : '#faad14'} trailColor="rgba(48,54,68,0.3)" strokeWidth={3} />
              <Tag color={analysis.bet_tier === '保守' ? 'orange' : analysis.bet_tier === '进取' ? 'red' : 'blue'} style={{ borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{analysis.bet_tier || '标准'}档</Tag>
            </div>
          )}
        </div>

        {!hasGameData ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>等待数据上传</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 16 }}>系统已就绪，请上传开奖记录开始AI分析</div>
            <Button type="primary" icon={<UploadIcon />} onClick={() => onNavigate(`/upload/${tableId}`)} style={{ borderRadius: 6 }}>上传数据</Button>
          </div>
        ) : aiAnalyzing ? (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: 28, marginBottom: 12, animation: 'pulse-glow 1.5s infinite', color: '#1890ff' }}><RobotIcon /></div>
            <div style={{ color: '#1890ff', fontSize: 14, fontWeight: 600 }}>AI三模型正在分析中...</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, marginBottom: 8 }}>
              {[{ name: '庄模型', icon: 'B', color: '#ff4d4f', delay: 0 }, { name: '闲模型', icon: 'P', color: '#1890ff', delay: 0.5 }, { name: '综合模型', icon: 'AI', color: '#52c41a', delay: 1 }].map((model) => (
                <div key={model.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 12px', borderRadius: 8, background: `rgba(${model.color === '#ff4d4f' ? '255,77,79' : model.color === '#1890ff' ? '24,144,255' : '82,196,26'}, 0.1)`, border: `1px solid rgba(${model.color === '#ff4d4f' ? '255,77,79' : model.color === '#1890ff' ? '24,144,255' : '82,196,26'}, 0.2)`, animation: `fadeInUp 0.3s ease ${model.delay}s both` }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: model.color }}>{model.icon}</span>
                  <span style={{ fontSize: 10, color: model.color, fontWeight: 600 }}>{model.name}</span>
                  <div style={{ width: 40, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: model.color, animation: `shimmer 1.5s ease-in-out ${model.delay}s infinite`, transformOrigin: 'left' }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 8 }}>正在并行调用 OpenAI · Claude · Gemini</div>
          </div>
        ) : !analysis ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ fontSize: 32, marginBottom: 12, animation: 'pulse-glow 2s infinite', color: '#52c41a' }}><RobotIcon /></div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>数据已就绪</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>已上传 {games.length} 局记录，正在准备AI分析...</div>
          </div>
        ) : (
          <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="model-block model-block-banker">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                <span className="model-icon-badge" style={{ color: '#ff4d4f', fontWeight: 700 }}>B</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#ff4d4f' }}>庄模型</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,77,79,0.5)', background: 'rgba(255,77,79,0.08)', padding: '1px 8px', borderRadius: 8 }}>OpenAI GPT-4o mini</span>
              </div>
              <p className="analysis-text">{analysis.banker_summary || '暂无庄向分析...'}</p>
            </div>
            <div className="model-block model-block-player">
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                <span className="model-icon-badge" style={{ color: '#1890ff', fontWeight: 700 }}>P</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#1890ff' }}>闲模型</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(24,144,255,0.5)', background: 'rgba(24,144,255,0.08)', padding: '1px 8px', borderRadius: 8 }}>Claude Sonnet 4</span>
              </div>
              <p className="analysis-text">{analysis.player_summary || '暂无闲向分析...'}</p>
            </div>
            <div className="model-block model-block-combined" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                <span className="model-icon-badge" style={{ color: '#52c41a', fontWeight: 700 }}>AI</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#52c41a' }}>综合模型</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(82,196,26,0.5)', background: 'rgba(82,196,26,0.08)', padding: '1px 8px', borderRadius: 8 }}>Gemini Flash</span>
              </div>
              <p className="analysis-text" style={{ fontWeight: 500, fontSize: 14 }}>{analysis.combined_summary || '暂无综合分析...'}</p>
            </div>
          </div>
        )}
      </div>

      {/* 智能警告 */}
      {(integrityIssues.length > 0 || abnormalPatterns.length > 0 || alerts.length > 0) && (
        <div className="analysis-card" style={{ minHeight: 'auto' }}>
          <div className="section-header">
            <span style={{ color: '#ff4d4f' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg></span>
            <span className="section-title">智能检测</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{integrityIssues.length + abnormalPatterns.length + alerts.length} 项提醒</span>
          </div>
          <div style={{ padding: '12px 16px 16px' }}>
            <SmartAlertsPanel integrityIssues={integrityIssues} abnormalPatterns={abnormalPatterns} alerts={alerts} onDismissAlert={onDismissAlert} />
          </div>
        </div>
      )}

      {/* 智能报告 */}
      {games.length > 0 && <SmartReport games={games as unknown as import('../../hooks/useGameState').GameRecord[]} bets={bets as unknown as import('../../hooks/useGameState').BetRecord[]} stats={stats as unknown as import('../../hooks/useGameState').Stats | null} period="daily" />}

      {/* 实盘日志 */}
      <div className="data-card" style={{ flex: 1, minHeight: 250, display: 'flex', flexDirection: 'column' }}>
        <div className="data-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#13c2c2' }}><FileIcon /></span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>实盘日志</span>
          </div>
          <Space size="small">
            <Select size="small" value={logCategory} onChange={(v) => { setLogCategory(v); }} options={LOG_CATEGORIES} style={{ width: 100, fontSize: 12 }} />
            <Switch size="small" checked={autoScroll} onChange={setAutoScroll} checkedChildren="自动" unCheckedChildren="暂停" />
          </Space>
        </div>
        <div className="log-table-wrapper data-card-body">
          <LogTable data={logs as []} scrollY={200} />
        </div>
      </div>

      {/* 下注记录 + 开奖记录 */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div className="data-card" style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div className="data-card-header"><span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}><CoinIcon /> 下注记录</span></div>
          <div className="data-card-body"><BetTable data={bets as []} page={betPage} total={betsTotal} onPageChange={onBetPageChange} /></div>
        </div>
        <div className="data-card" style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div className="data-card-header">
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>开奖记录</span>
            <Space size={6}>
              <span className={`stat-badge-inline ${(stats?.accuracy || 0) >= 55 ? 'stat-accuracy-high' : (stats?.accuracy || 0) >= 45 ? 'stat-accuracy-mid' : 'stat-accuracy-low'}`}><FireIcon /> {(stats?.accuracy || 0).toFixed(1)}%</span>
            </Space>
          </div>
          <div className="data-card-body"><GameTable data={games as []} page={gamePage} total={gamesTotal} onPageChange={onGamePageChange} /></div>
        </div>
      </div>
    </div>
  );
};
