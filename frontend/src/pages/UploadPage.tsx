/**
 * 数据上传页面 - 百家乐分析预测系统（手动模式）
 * 功能：
 * - 手动输入66局（或任意局数）的开奖结果（庄/和/闲）
 * - 确认上传后，自动计算五路走势，触发AI分析预测下一局
 * - 支持快速填充、清空等辅助操作
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal, Input } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import * as api from '../services/api';
import { getToken } from '../services/api';

type GameResult = '庄' | '闲' | '和' | '';

// 快捷序列填充（用于测试）
const QUICK_FILLS: { label: string; pattern: GameResult[] }[] = [
  { label: '全庄', pattern: ['庄'] },
  { label: '全闲', pattern: ['闲'] },
  { label: '交替', pattern: ['庄', '闲'] },
];

const RESULT_COLORS: Record<string, string> = {
  '庄': '#ff4d4f',
  '闲': '#1890ff',
  '和': '#52c41a',
  '': 'rgba(255,255,255,0.15)',
};

const RESULT_BG: Record<string, string> = {
  '庄': 'rgba(255,77,79,0.12)',
  '闲': 'rgba(24,144,255,0.12)',
  '和': 'rgba(82,196,26,0.12)',
  '': 'rgba(255,255,255,0.04)',
};

const DEFAULT_ROWS = 66;

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 66局数据
  const [games, setGames] = useState<GameResult[]>(Array(DEFAULT_ROWS).fill(''));
  const [rowCount, setRowCount] = useState(DEFAULT_ROWS);
  const [tableId, setTableId] = useState<'26' | '27'>('26');
  const [bootNumber, setBootNumber] = useState<number | undefined>(undefined);
  const [uploading, setUploading] = useState(false);

  // 登录弹窗
  const [loginVisible, setLoginVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // 粒子背景
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isMobile = window.innerWidth <= 768;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    interface P { x: number; y: number; size: number; sx: number; sy: number; op: number; color: string }
    const particles: P[] = [];
    const n = isMobile ? 25 : 60;
    for (let i = 0; i < n; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2.5 + 0.8,
        sx: (Math.random() - 0.5) * 0.4,
        sy: (Math.random() - 0.5) * 0.4,
        op: Math.random() * 0.5 + 0.15,
        color: ['#ffd700', '#ff4d4f', '#1890ff', '#52c41a'][Math.floor(Math.random() * 4)],
      });
    }

    let aid: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.sx;
        p.y += p.sy;
        if (p.x < 0 || p.x > canvas.width) p.sx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.sy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.op;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      });
      aid = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(aid);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // 调整行数
  const handleRowCountChange = (n: number) => {
    const count = Math.max(1, Math.min(66, n));
    setRowCount(count);
    setGames(prev => {
      const next = [...prev];
      while (next.length < count) next.push('');
      return next.slice(0, count);
    });
  };

  // 点击切换结果
  const handleCellClick = (idx: number) => {
    setGames(prev => {
      const next = [...prev];
      const cycle: GameResult[] = ['庄', '闲', '和', ''];
      const cur = next[idx];
      const ci = cycle.indexOf(cur);
      next[idx] = cycle[(ci + 1) % cycle.length];
      return next;
    });
  };

  // 快捷填充
  const handleQuickFill = (pattern: GameResult[]) => {
    setGames(prev => prev.map((_, i) => pattern[i % pattern.length]));
  };

  // 清空
  const handleClear = () => {
    setGames(Array(rowCount).fill(''));
  };

  // 统计
  const filled = games.filter(g => g !== '').length;
  const bankerCount = games.filter(g => g === '庄').length;
  const playerCount = games.filter(g => g === '闲').length;
  const tieCount = games.filter(g => g === '和').length;

  // 上传确认
  const handleUpload = async () => {
    const validGames = games
      .map((result, idx) => ({ game_number: idx + 1, result }))
      .filter(g => g.result !== '');

    if (validGames.length === 0) {
      message.warning('请至少填入1局开奖结果');
      return;
    }

    Modal.confirm({
      title: '确认上传开奖记录',
      content: (
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>
          <p>将上传 <strong style={{ color: '#ffd700' }}>{validGames.length}</strong> 局数据到 <strong style={{ color: '#ffd700' }}>{tableId}桌</strong></p>
          <p style={{ marginBottom: 0, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            庄{bankerCount}次 · 闲{playerCount}次 · 和{tieCount}次
          </p>
          <p style={{ marginTop: 8, color: 'rgba(255,165,0,0.8)', fontSize: 12 }}>
            上传后系统将自动计算五路走势图并开始AI分析预测
          </p>
        </div>
      ),
      okText: '确认上传',
      cancelText: '返回检查',
      okButtonProps: { style: { background: 'linear-gradient(135deg,#ffd700,#f0b90b)', borderColor: '#ffd700', color: '#000', fontWeight: 700 } },
      centered: true,
      maskStyle: { backdropFilter: 'blur(8px)' },
      styles: {
        content: {
          background: 'rgba(15,21,33,0.97)',
          border: '1px solid rgba(255,215,0,0.2)',
        },
        header: { background: 'transparent' },
      },
      onOk: async () => {
        setUploading(true);
        try {
          const res = await api.uploadGameResults(tableId, validGames as api.GameUploadItem[], bootNumber);
          if (res.data.success) {
            message.success(`✅ 上传成功！${res.data.uploaded}局数据已入库，AI分析进行中...`);
            navigate(`/dashboard/${tableId}`);
          }
        } catch (err: any) {
          message.error(err.response?.data?.detail || '上传失败，请重试');
          setUploading(false);
        }
      },
    });
  };

  // 管理员登录
  const handleLogin = async () => {
    if (!password) return;
    setLoginLoading(true);
    try {
      const res = await api.adminLogin('admin', password);
      const { must_change_password, token } = res.data;
      localStorage.setItem('admin_token', token);
      if (must_change_password) {
        message.warning('首次登录请修改默认密码');
        navigate('/admin', { state: { mustChangePassword: true, token } });
      } else {
        navigate('/admin', { state: { token } });
      }
      setLoginVisible(false);
    } catch (err: any) {
      message.error(err.response?.data?.detail || '登录失败');
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflow: 'auto',
      background: 'linear-gradient(135deg, #0a0e17 0%, #111927 30%, #0f1623 60%, #0a101c 100%)',
      padding: '20px 16px 40px',
    }}>
      {/* 粒子背景 */}
      <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} />
      
      {/* 背景光晕 */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none',
        background: `radial-gradient(circle at 20% 50%, rgba(255,77,79,0.06) 0%, transparent 50%),
                     radial-gradient(circle at 80% 20%, rgba(24,144,255,0.06) 0%, transparent 50%),
                     radial-gradient(circle at 50% 80%, rgba(255,215,0,0.04) 0%, transparent 50%)`
      }} />

      {/* 管理员按钮 */}
      <button
        className="admin-entry-btn"
        onClick={() => setLoginVisible(true)}
        style={{ zIndex: 10 }}
      >
        🔐 管理员
      </button>

      {/* 主卡片 */}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 860, marginTop: 16 }}>
        
        {/* 标题区 */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 42, marginBottom: 10, filter: 'drop-shadow(0 0 24px rgba(255,215,0,0.5))', animation: 'pulse-glow 3s infinite' }}>🎰</div>
          <h1 style={{
            fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 800, margin: 0,
            background: 'linear-gradient(135deg, #ffd700 0%, #fff 40%, #ffd700 70%, #b8860b 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundSize: '200% auto', animation: 'shimmer-text 3s linear infinite',
          }}>
            百家乐分析预测系统
          </h1>
          <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 'clamp(12px, 2.5vw, 14px)', letterSpacing: '1.5px' }}>
            手动上传开奖记录 · AI三模型分析预测
          </p>
        </div>

        {/* 控制栏 */}
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderRadius: 16, marginBottom: 16,
          background: 'rgba(22,29,42,0.85)', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {/* 桌台选择 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', minWidth: 36 }}>桌台</span>
            {(['26', '27'] as const).map(t => (
              <button key={t} onClick={() => setTableId(t)} style={{
                padding: '6px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                background: tableId === t
                  ? (t === '26' ? 'linear-gradient(135deg,#dc3545,#c41d33)' : 'linear-gradient(135deg,#1890ff,#096dd9)')
                  : 'rgba(255,255,255,0.05)',
                color: tableId === t ? '#fff' : 'rgba(255,255,255,0.5)',
                boxShadow: tableId === t ? (t === '26' ? '0 4px 16px rgba(220,53,69,0.3)' : '0 4px 16px rgba(24,144,255,0.3)') : 'none',
                transition: 'all 0.2s',
              }}>
                {t}桌
              </button>
            ))}
          </div>

          {/* 局数控制 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', minWidth: 30 }}>局数</span>
            <button onClick={() => handleRowCountChange(rowCount - 1)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#ffd700', minWidth: 30, textAlign: 'center' }}>{rowCount}</span>
            <button onClick={() => handleRowCountChange(rowCount + 1)} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            <button onClick={() => handleRowCountChange(66)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,215,0,0.3)', background: 'rgba(255,215,0,0.06)', color: '#ffd700', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>满66局</button>
          </div>

          {/* 快捷填充 */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', minWidth: 36 }}>快填</span>
            {QUICK_FILLS.map(f => (
              <button key={f.label} onClick={() => handleQuickFill(f.pattern)} style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12,
              }}>
                {f.label}
              </button>
            ))}
            <button onClick={handleClear} style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,77,79,0.3)',
              background: 'rgba(255,77,79,0.06)', color: '#ff7875', cursor: 'pointer', fontSize: 12,
            }}>
              清空
            </button>
          </div>
        </div>

        {/* 统计条 */}
        <div style={{
          display: 'flex', gap: 16, padding: '10px 20px', borderRadius: 12, marginBottom: 12,
          background: 'rgba(22,29,42,0.6)', border: '1px solid rgba(255,255,255,0.05)',
          flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>已填 <strong style={{ color: '#ffd700', fontSize: 15 }}>{filled}</strong>/{rowCount}局</span>
          <span style={{ fontSize: 12, color: RESULT_COLORS['庄'] }}>庄 <strong>{bankerCount}</strong></span>
          <span style={{ fontSize: 12, color: RESULT_COLORS['闲'] }}>闲 <strong>{playerCount}</strong></span>
          <span style={{ fontSize: 12, color: RESULT_COLORS['和'] }}>和 <strong>{tieCount}</strong></span>
          {filled > 0 && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
              点击格子切换结果：庄 → 闲 → 和 → 空
            </span>
          )}
        </div>

        {/* 游戏格子网格 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
          gap: 8,
          padding: '16px',
          borderRadius: 16,
          background: 'rgba(22,29,42,0.85)',
          border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 20,
          maxHeight: 520,
          overflowY: 'auto',
        }}>
          {games.map((result, idx) => (
            <button
              key={idx}
              onClick={() => handleCellClick(idx)}
              style={{
                height: 56,
                borderRadius: 10,
                border: `1.5px solid ${result ? RESULT_COLORS[result] : 'rgba(255,255,255,0.1)'}`,
                background: result ? RESULT_BG[result] : 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                transition: 'all 0.15s',
                outline: 'none',
                position: 'relative',
              }}
            >
              {/* 局号 */}
              <span style={{
                fontSize: 10, color: 'rgba(255,255,255,0.3)',
                position: 'absolute', top: 4, left: 6,
              }}>
                {idx + 1}
              </span>
              {/* 结果 */}
              {result ? (
                <span style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: RESULT_COLORS[result],
                  textShadow: `0 0 10px ${RESULT_COLORS[result]}60`,
                }}>
                  {result}
                </span>
              ) : (
                <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.12)', fontWeight: 300 }}>·</span>
              )}
            </button>
          ))}
        </div>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* 查看仪表盘（不上传） */}
          <button
            onClick={() => navigate(`/dashboard/${tableId}`)}
            style={{
              padding: '14px 28px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
              minWidth: 140,
              transition: 'all 0.2s',
            }}
          >
            📊 查看仪表盘
          </button>

          {/* 确认上传 */}
          <button
            onClick={handleUpload}
            disabled={uploading || filled === 0}
            style={{
              padding: '14px 36px',
              borderRadius: 14,
              border: 'none',
              background: filled === 0
                ? 'rgba(255,255,255,0.06)'
                : 'linear-gradient(135deg, #ffd700 0%, #f0b90b 50%, #d4a017 100%)',
              color: filled === 0 ? 'rgba(255,255,255,0.3)' : '#000',
              cursor: filled === 0 ? 'not-allowed' : 'pointer',
              fontSize: 16,
              fontWeight: 800,
              minWidth: 180,
              boxShadow: filled > 0 ? '0 6px 24px rgba(255,215,0,0.35)' : 'none',
              transition: 'all 0.2s',
              opacity: uploading ? 0.7 : 1,
              letterSpacing: '0.5px',
            }}
          >
            {uploading ? '⏳ 上传中...' : `✅ 确认上传 (${filled}局)`}
          </button>
        </div>

        {/* 操作提示 */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <SafetyCertificateOutlined style={{ color: 'rgba(82,196,26,0.5)', fontSize: 13 }} />
          <span style={{ marginLeft: 6, color: 'rgba(255,255,255,0.22)', fontSize: 11, letterSpacing: '0.3px' }}>
            仿真验证系统 · 不涉及真实下注 · 数据仅供学习研究
          </span>
        </div>
      </div>

      {/* 登录弹窗 */}
      <Modal
        open={loginVisible}
        onCancel={() => { setLoginVisible(false); setPassword(''); }}
        footer={null}
        centered
        maskStyle={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.75)' }}
        styles={{
          content: {
            borderRadius: 20,
            background: 'linear-gradient(145deg, rgba(22,29,42,0.98), rgba(15,20,31,0.98))',
            border: '1px solid rgba(255,215,0,0.2)',
            boxShadow: '0 25px 80px rgba(0,0,0,0.6), 0 0 60px rgba(255,215,0,0.06)',
            padding: '36px 32px 32px',
          },
        }}
        width={420}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🔐</div>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: '#fff' }}>管理员登录</h2>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>仅限授权人员访问</p>
        </div>
        <Input.Password
          value={password}
          onChange={e => setPassword(e.target.value)}
          onPressEnter={handleLogin}
          placeholder="请输入管理员密码"
          size="large"
          autoFocus
          style={{ height: 50, borderRadius: 12, fontSize: 15 }}
          styles={{ input: { color: '#fff' } }}
        />
        <button
          className="login-gold-btn"
          onClick={handleLogin}
          disabled={loginLoading || !password}
          style={{ opacity: loginLoading ? 0.7 : 1, marginTop: 16 }}
        >
          {loginLoading ? '⏳ 验证中...' : '🔑 登录进入管理面板'}
        </button>
      </Modal>
    </div>
  );
};

export default UploadPage;
