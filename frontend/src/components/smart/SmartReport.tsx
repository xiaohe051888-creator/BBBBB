/**
 * 智能报告组件
 * 自动生成日报/周报，展示胜率趋势、盈亏分析等
 */
import React from 'react';
import type { GameRecord, BetRecord, Stats } from '../../hooks';

// ====== 类型定义 ======

interface SmartReportProps {
  games: GameRecord[];
  bets: BetRecord[];
  stats: Stats | null;
  period?: 'daily' | 'weekly' | 'monthly';
}

interface ReportData {
  period: string;
  totalGames: number;
  totalBets: number;
  winRate: number;
  profitLoss: number;
  maxWinStreak: number;
  maxLossStreak: number;
  avgBetAmount: number;
  bestTier: string;
  trend: 'up' | 'down' | 'stable';
  recommendations: string[];
}

// ====== 组件 ======

export const SmartReport: React.FC<SmartReportProps> = ({
  games,
  bets,
  stats,
  period = 'daily',
}) => {
  // 生成报告数据
  const reportData: ReportData = React.useMemo(() => {
    const periodNames: Record<string, string> = {
      daily: '今日',
      weekly: '本周',
      monthly: '本月',
    };

    // 计算基础数据
    const totalGames = games.length;
    const totalBets = bets.length;
    
    // 计算盈亏
    const profitLoss = bets.reduce((sum, bet) => sum + (bet.profit_loss || 0), 0);
    
    // 计算平均下注金额
    const avgBetAmount = totalBets > 0
      ? bets.reduce((sum, bet) => sum + bet.bet_amount, 0) / totalBets
      : 0;

    // 计算最大连胜/连败
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    const sortedBets = [...bets].sort((a, b) => {
      const timeA = a.bet_time ? new Date(a.bet_time).getTime() : 0;
      const timeB = b.bet_time ? new Date(b.bet_time).getTime() : 0;
      return timeA - timeB;
    });

    sortedBets.forEach(bet => {
      const isWin = bet.profit_loss && bet.profit_loss > 0;
      if (isWin) {
        currentWinStreak++;
        currentLossStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      } else {
        currentLossStreak++;
        currentWinStreak = 0;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
      }
    });

    // 计算最佳策略
    const tierStats: Record<string, { wins: number; total: number }> = {};
    sortedBets.forEach(bet => {
      const tier = bet.bet_tier || '标准';
      if (!tierStats[tier]) tierStats[tier] = { wins: 0, total: 0 };
      tierStats[tier].total++;
      if (bet.profit_loss && bet.profit_loss > 0) {
        tierStats[tier].wins++;
      }
    });

    let bestTier = '标准';
    let bestTierRate = 0;
    Object.entries(tierStats).forEach(([tier, stat]) => {
      const rate = stat.total > 0 ? stat.wins / stat.total : 0;
      if (rate > bestTierRate && stat.total >= 3) {
        bestTierRate = rate;
        bestTier = tier;
      }
    });

    // 计算趋势
    const winRate = stats?.accuracy || 0;
    const trend: ReportData['trend'] = winRate > 55 ? 'up' : winRate < 45 ? 'down' : 'stable';

    // 生成建议
    const recommendations: string[] = [];
    if (winRate < 40) {
      recommendations.push('近期胜率偏低，建议调整策略或暂停下注');
    }
    if (maxLossStreak >= 5) {
      recommendations.push(`出现${maxLossStreak}连败，建议降低仓位或观望`);
    }
    if (profitLoss < -1000) {
      recommendations.push('累计亏损较大，建议重新评估策略');
    }
    if (recommendations.length === 0) {
      if (winRate > 60) {
        recommendations.push('胜率表现优秀，当前策略效果良好');
      } else {
        recommendations.push('系统运行正常，建议保持当前策略');
      }
    }

    return {
      period: periodNames[period],
      totalGames,
      totalBets,
      winRate,
      profitLoss,
      maxWinStreak,
      maxLossStreak,
      avgBetAmount,
      bestTier,
      trend,
      recommendations,
    };
  }, [games, bets, stats, period]);

  // 趋势图标
  const TrendIcon = () => {
    if (reportData.trend === 'up') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#52c41a">
          <path d="M7 14l5-5 5 5H7z" />
        </svg>
      );
    }
    if (reportData.trend === 'down') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#ff4d4f">
          <path d="M7 10l5 5 5-5H7z" />
        </svg>
      );
    }
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#faad14">
        <path d="M7 12h10v2H7z" />
      </svg>
    );
  };

  return (
    <div style={styles.container}>
      {/* 报告头部 */}
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <h3 style={styles.title}>{reportData.period}智能报告</h3>
          <div style={styles.trendBadge}>
            <TrendIcon />
            <span style={styles.trendText}>
              {reportData.trend === 'up' ? '上升' : reportData.trend === 'down' ? '下降' : '平稳'}
            </span>
          </div>
        </div>
        <p style={styles.subtitle}>自动生成于 {new Date().toLocaleString('zh-CN')}</p>
      </div>

      {/* 核心指标 */}
      <div style={styles.metricsGrid}>
        <MetricCard
          label="胜率"
          value={`${reportData.winRate.toFixed(1)}%`}
          color={reportData.winRate >= 50 ? '#52c41a' : '#ff4d4f'}
        />
        <MetricCard
          label="盈亏"
          value={reportData.profitLoss >= 0 ? `+${reportData.profitLoss}` : `${reportData.profitLoss}`}
          color={reportData.profitLoss >= 0 ? '#52c41a' : '#ff4d4f'}
        />
        <MetricCard
          label="下注次数"
          value={reportData.totalBets.toString()}
          color="#1890ff"
        />
        <MetricCard
          label="平均下注"
          value={reportData.avgBetAmount.toFixed(0)}
          color="#faad14"
        />
      </div>

      {/* 连胜/连败 */}
      <div style={styles.streakRow}>
        <StreakCard type="win" count={reportData.maxWinStreak} />
        <StreakCard type="loss" count={reportData.maxLossStreak} />
        <div style={styles.tierCard}>
          <span style={styles.tierLabel}>最佳策略</span>
          <span style={styles.tierValue}>{reportData.bestTier}</span>
        </div>
      </div>

      {/* 智能建议 */}
      <div style={styles.recommendations}>
        <h4 style={styles.recTitle}>智能建议</h4>
        {reportData.recommendations.map((rec, index) => (
          <div key={index} style={styles.recItem}>
            <span style={styles.recDot}>•</span>
            <span style={styles.recText}>{rec}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 指标卡片组件
const MetricCard: React.FC<{ label: string; value: string; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div style={{ ...styles.metricCard, borderColor: `${color}40` }}>
    <span style={{ ...styles.metricValue, color }}>{value}</span>
    <span style={styles.metricLabel}>{label}</span>
  </div>
);

// 连胜/连败卡片
const StreakCard: React.FC<{ type: 'win' | 'loss'; count: number }> = ({ type, count }) => {
  const isWin = type === 'win';
  const color = isWin ? '#52c41a' : '#ff4d4f';
  const label = isWin ? '最大连胜' : '最大连败';

  return (
    <div style={{ ...styles.streakCard, background: `${color}10`, borderColor: `${color}30` }}>
      <span style={{ ...styles.streakCount, color }}>{count}</span>
      <span style={styles.streakLabel}>{label}</span>
    </div>
  );
};

// 样式
const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'linear-gradient(145deg, rgba(22,29,42,0.9), rgba(17,23,35,0.9))',
    borderRadius: 16,
    border: '1px solid rgba(48,54,68,0.4)',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(48,54,68,0.3)',
    background: 'rgba(0,0,0,0.2)',
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
  },
  trendBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.05)',
  },
  trendText: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.7)',
  },
  subtitle: {
    margin: 0,
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
    padding: 16,
  },
  metricCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 8px',
    borderRadius: 10,
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(48,54,68,0.3)',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  streakRow: {
    display: 'flex',
    gap: 12,
    padding: '0 16px 16px',
  },
  streakCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 8px',
    borderRadius: 10,
    border: '1px solid rgba(48,54,68,0.3)',
  },
  streakCount: {
    fontSize: 24,
    fontWeight: 800,
    marginBottom: 2,
  },
  streakLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  tierCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 8px',
    borderRadius: 10,
    background: 'rgba(255,215,0,0.1)',
    border: '1px solid rgba(255,215,0,0.2)',
  },
  tierLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  tierValue: {
    fontSize: 14,
    fontWeight: 700,
    color: '#ffd700',
  },
  recommendations: {
    padding: '16px 20px',
    borderTop: '1px solid rgba(48,54,68,0.3)',
    background: 'rgba(0,0,0,0.15)',
  },
  recTitle: {
    margin: '0 0 10px 0',
    fontSize: 13,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.8)',
  },
  recItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  recDot: {
    color: '#1890ff',
    fontSize: 14,
    lineHeight: '18px',
  },
  recText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: '18px',
  },
};

export default SmartReport;
