/**
 * 数据上传页面 - 百家乐分析预测系统（手动模式）
 * 功能：
 * - 手动输入66局（或任意局数）的开奖结果（庄/和/闲）
 * - 确认上传后，自动计算五路走势，触发AI分析预测下一局
 * - 支持快速填充、清空等辅助操作
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal, Input } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import * as api from '../services/api';

type GameResult = '庄' | '闲' | '和' | '';

// 快捷序列填充（用于测试）
const QUICK_FILLS: { label: string; pattern: GameResult[] }[] = [
  { label: '全庄', pattern: ['庄'] },
  { label: '全闲', pattern: ['闲'] },
  { label: '交替', pattern: ['庄', '闲'] },
];

// 数字映射
const NUM_TO_RESULT: Record<string, GameResult> = {
  '1': '庄',
  '2': '闲',
  '3': '和',
};

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
const BEAD_ROWS = 6;  // 珠盘路固定6行
const BEAD_COLS = 14; // 珠盘路固定14列（与后端和类型定义一致）

const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 66局数据
  const [games, setGames] = useState<GameResult[]>(Array(DEFAULT_ROWS).fill(''));
  const [rowCount, setRowCount] = useState(DEFAULT_ROWS);
  const [tableId, setTableId] = useState<'26' | '27'>('26');
  const [bootNumber] = useState<number | undefined>(undefined);
  const [uploading, setUploading] = useState(false);

  // 登录弹窗
  const [loginVisible, setLoginVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // 数字填充弹窗
  const [numberFillVisible, setNumberFillVisible] = useState(false);
  const [numberInput, setNumberInput] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [numberFillLoading, setNumberFillLoading] = useState(false);

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

  // 数字填充处理
  const handleNumberFill = () => {
    if (!numberInput.trim()) {
      message.warning('请输入数字序列');
      return;
    }

    const validChars = numberInput.trim().replace(/[^123]/g, '');
    if (validChars.length === 0) {
      message.warning('请输入有效的数字（1=庄, 2=闲, 3=和）');
      return;
    }

    // 限制填充数量不超过当前局数
    const fillCount = Math.min(validChars.length, rowCount);
    
    setGames(prev => {
      const next = [...prev];
      for (let i = 0; i < fillCount; i++) {
        next[i] = NUM_TO_RESULT[validChars[i]];
      }
      return next;
    });

    message.success(`已填充 ${fillCount} 局数据`);
    setNumberFillVisible(false);
    setNumberInput('');
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
      onOk: async () => {
        setUploading(true);
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res = await api.uploadGameResults(tableId, validGames as any, bootNumber);
          if (res.data.success) {
            message.success(`✅ 上传成功！${res.data.uploaded}局数据已入库，AI分析进行中...`);
            navigate(`/dashboard/${tableId}`);
          }
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : '上传失败，请重试';
          message.error(errorMsg);
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
      api.setToken(token);
      if (must_change_password) {
        message.warning('首次登录请修改默认密码');
        navigate('/admin', { state: { mustChangePassword: true, token } });
      } else {
        navigate('/admin', { state: { token } });
      }
      setLoginVisible(false);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '登录失败';
      message.error(errorMsg);
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

        {/* 控制栏 - 重新排版 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '20px 24px',
          borderRadius: 20,
          marginBottom: 20,
          background: 'linear-gradient(145deg, rgba(22,29,42,0.9), rgba(15,21,33,0.9))',
          border: '1px solid rgba(255,215,0,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
          {/* 第一行：桌台 + 局数 */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* 桌台选择 */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>桌台</span>
              {(['26', '27'] as const).map(t => (
                <button key={t} onClick={() => setTableId(t)} style={{
                  padding: '8px 20px',
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 15,
                  background: tableId === t
                    ? (t === '26' ? 'linear-gradient(135deg,#ff4d4f,#dc3545)' : 'linear-gradient(135deg,#1890ff,#096dd9)')
                    : 'rgba(255,255,255,0.06)',
                  color: tableId === t ? '#fff' : 'rgba(255,255,255,0.5)',
                  boxShadow: tableId === t ? (t === '26' ? '0 4px 16px rgba(255,77,79,0.35)' : '0 4px 16px rgba(24,144,255,0.35)') : 'none',
                  transition: 'all 0.2s',
                }}>
                  {t}桌
                </button>
              ))}
            </div>

            {/* 局数控制 */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>局数</span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px',
                borderRadius: 12,
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <button onClick={() => handleRowCountChange(rowCount - 1)} style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>−</button>
                <span style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#ffd700',
                  minWidth: 36,
                  textAlign: 'center',
                  textShadow: '0 0 10px rgba(255,215,0,0.3)',
                }}>{rowCount}</span>
                <button onClick={() => handleRowCountChange(rowCount + 1)} style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>+</button>
              </div>
              <button onClick={() => handleRowCountChange(66)} style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: '1px solid rgba(255,215,0,0.25)',
                background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,215,0,0.04))',
                color: '#ffd700',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 0.15s',
              }}>满66局</button>
            </div>
          </div>

          {/* 第二行：快捷填充 + 数字填充 */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* 快捷填充 */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>快捷</span>
              {QUICK_FILLS.map(f => (
                <button key={f.label} onClick={() => handleQuickFill(f.pattern)} style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.65)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  transition: 'all 0.15s',
                }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* 分隔线 */}
            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />

            {/* 数字填充按钮 */}
            <button
              onClick={() => setNumberFillVisible(true)}
              style={{
                padding: '8px 18px',
                borderRadius: 10,
                border: '1px solid rgba(114,46,209,0.4)',
                background: 'linear-gradient(135deg, rgba(114,46,209,0.15), rgba(114,46,209,0.05))',
                color: '#b37feb',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
            >
              <span>🔢</span>
              <span>数字填充</span>
            </button>

            {/* 清空按钮 */}
            <button onClick={handleClear} style={{
              padding: '8px 18px',
              borderRadius: 10,
              border: '1px solid rgba(255,77,79,0.3)',
              background: 'rgba(255,77,79,0.06)',
              color: '#ff7875',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              marginLeft: 'auto',
              transition: 'all 0.15s',
            }}>
              🗑️ 清空
            </button>
          </div>
        </div>

        {/* 统计条 - 重新设计 */}
        <div style={{
          display: 'flex',
          gap: 20,
          padding: '16px 24px',
          borderRadius: 16,
          marginBottom: 20,
          background: 'linear-gradient(90deg, rgba(22,29,42,0.8), rgba(30,40,60,0.8))',
          border: '1px solid rgba(255,255,255,0.06)',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {/* 总进度 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: `conic-gradient(#ffd700 ${filled / rowCount * 360}deg, rgba(255,255,255,0.08) 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(15,21,33,0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#ffd700' }}>{filled}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>已填/总局</span>
                <span style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>{filled}/{rowCount}</span>
              </div>
            </div>

            {/* 分隔线 */}
            <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.08)' }} />

            {/* 各结果统计 */}
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(255,77,79,0.08)',
                border: '1px solid rgba(255,77,79,0.15)',
              }}>
                <span style={{ fontSize: 12, color: '#ff7875' }}>庄</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#ff4d4f' }}>{bankerCount}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(24,144,255,0.08)',
                border: '1px solid rgba(24,144,255,0.15)',
              }}>
                <span style={{ fontSize: 12, color: '#69c0ff' }}>闲</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1890ff' }}>{playerCount}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(82,196,26,0.08)',
                border: '1px solid rgba(82,196,26,0.15)',
              }}>
                <span style={{ fontSize: 12, color: '#95de64' }}>和</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#52c41a' }}>{tieCount}</span>
              </div>
            </div>
          </div>

          {/* 操作提示 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              💡 点击圆圈切换：庄 → 闲 → 和 → 空
            </span>
          </div>
        </div>

        {/* 珠盘路面板 - 6行×11列 - 重新设计 */}
        <div style={{
          padding: '24px 28px',
          borderRadius: 24,
          background: 'linear-gradient(145deg, rgba(22,29,42,0.9), rgba(15,21,33,0.9))',
          border: '1px solid rgba(255,215,0,0.08)',
          marginBottom: 24,
          boxShadow: '0 12px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}>
          {/* 珠盘路网格 - 按列渲染 */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
          }}>
            {Array.from({ length: BEAD_COLS }).map((_, colIdx) => (
              <div key={colIdx} style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                {Array.from({ length: BEAD_ROWS }).map((_, rowIdx) => {
                  // 计算局号：第1列是1-6，第2列是7-12，以此类推
                  const gameIdx = colIdx * BEAD_ROWS + rowIdx;
                  const result = games[gameIdx] || '';
                  const gameNumber = gameIdx + 1;

                  // 如果超出当前设置的局数，显示为禁用状态
                  const isDisabled = gameIdx >= rowCount;

                  return (
                    <button
                      key={rowIdx}
                      onClick={() => !isDisabled && handleCellClick(gameIdx)}
                      disabled={isDisabled}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        border: `2px solid ${isDisabled ? 'rgba(255,255,255,0.04)' : (result ? RESULT_COLORS[result] : 'rgba(255,255,255,0.12)')}`,
                        background: isDisabled
                          ? 'rgba(255,255,255,0.02)'
                          : (result ? RESULT_BG[result] : 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))'),
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        outline: 'none',
                        position: 'relative',
                        opacity: isDisabled ? 0.25 : 1,
                        boxShadow: result
                          ? `0 4px 16px ${RESULT_COLORS[result]}30, inset 0 1px 0 rgba(255,255,255,0.1)`
                          : '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
                      }}
                    >
                      {/* 局号或结果显示 */}
                      {result ? (
                        <span style={{
                          fontSize: 20,
                          fontWeight: 800,
                          color: RESULT_COLORS[result],
                          textShadow: `0 0 12px ${RESULT_COLORS[result]}60`,
                        }}>
                          {result}
                        </span>
                      ) : (
                        <span style={{
                          fontSize: isDisabled ? 13 : 16,
                          fontWeight: isDisabled ? 400 : 700,
                          color: isDisabled ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.35)',
                        }}>
                          {gameNumber}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* 列号标注 */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            marginTop: 12,
          }}>
            {Array.from({ length: BEAD_COLS }).map((_, colIdx) => (
              <div key={colIdx} style={{
                width: 56,
                textAlign: 'center',
                fontSize: 11,
                color: 'rgba(255,255,255,0.2)',
                fontWeight: 500,
              }}>
                {colIdx + 1}
              </div>
            ))}
          </div>
        </div>

        {/* 操作按钮 - 重新设计 */}
        <div style={{
          display: 'flex',
          gap: 16,
          justifyContent: 'center',
          flexWrap: 'wrap',
          padding: '24px',
          borderRadius: 20,
          background: 'linear-gradient(145deg, rgba(22,29,42,0.6), rgba(15,21,33,0.6))',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          {/* 查看仪表盘（不上传） */}
          <button
            onClick={() => navigate(`/dashboard/${tableId}`)}
            style={{
              padding: '16px 32px',
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
              color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
              minWidth: 160,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
          >
            <span>📊</span>
            <span>查看仪表盘</span>
          </button>

          {/* 确认上传 */}
          <button
            onClick={handleUpload}
            disabled={uploading || filled === 0}
            style={{
              padding: '16px 40px',
              borderRadius: 16,
              border: 'none',
              background: filled === 0
                ? 'rgba(255,255,255,0.06)'
                : 'linear-gradient(135deg, #ffd700 0%, #f0b90b 50%, #d4a017 100%)',
              color: filled === 0 ? 'rgba(255,255,255,0.3)' : '#000',
              cursor: filled === 0 ? 'not-allowed' : 'pointer',
              fontSize: 17,
              fontWeight: 800,
              minWidth: 200,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: filled > 0 ? '0 8px 32px rgba(255,215,0,0.4)' : 'none',
              transition: 'all 0.2s',
              opacity: uploading ? 0.7 : 1,
              letterSpacing: '0.5px',
            }}
          >
            {uploading ? (
              <>
                <span>⏳</span>
                <span>上传中...</span>
              </>
            ) : (
              <>
                <span>✅</span>
                <span>确认上传 ({filled}局)</span>
              </>
            )}
          </button>
        </div>

        {/* 操作提示 */}
        <div style={{
          marginTop: 28,
          textAlign: 'center',
          padding: '12px 24px',
          borderRadius: 12,
          background: 'rgba(82,196,26,0.06)',
          border: '1px solid rgba(82,196,26,0.12)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          margin: '28px auto 0',
        }}>
          <SafetyCertificateOutlined style={{ color: 'rgba(82,196,26,0.7)', fontSize: 14 }} />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: '0.3px' }}>
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

      {/* 数字填充弹窗 */}
      <Modal
        open={numberFillVisible}
        onCancel={() => { setNumberFillVisible(false); setNumberInput(''); }}
        footer={null}
        centered
        maskStyle={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.75)' }}
        width={480}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(114,46,209,0.2), rgba(114,46,209,0.08))',
            border: '1px solid rgba(114,46,209,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 28,
          }}>
            🔢
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>数字填充</h2>
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
            输入数字序列快速填充开奖结果
          </p>
        </div>

        {/* 说明卡片 */}
        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
          marginBottom: 20,
          padding: '12px 16px',
          borderRadius: 12,
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'rgba(255,77,79,0.15)',
              border: '1px solid rgba(255,77,79,0.3)',
              color: '#ff7875',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>1</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>= 庄</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'rgba(24,144,255,0.15)',
              border: '1px solid rgba(24,144,255,0.3)',
              color: '#69c0ff',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>2</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>= 闲</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: 'rgba(82,196,26,0.15)',
              border: '1px solid rgba(82,196,26,0.3)',
              color: '#95de64',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>3</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>= 和</span>
          </div>
        </div>

        {/* 输入框 */}
        <div style={{ marginBottom: 20 }}>
          <Input
            value={numberInput}
            onChange={e => {
              // 只允许输入1、2、3
              const val = e.target.value.replace(/[^123]/g, '').slice(0, rowCount);
              setNumberInput(val);
            }}
            onPressEnter={handleNumberFill}
            placeholder={`请输入数字序列，例如：11132211（最多${rowCount}位）`}
            size="large"
            autoFocus
            style={{
              height: 56,
              borderRadius: 14,
              fontSize: 18,
              fontFamily: 'monospace',
              letterSpacing: '2px',
              textAlign: 'center',
            }}
            styles={{ input: { color: '#fff' } }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 10,
            fontSize: 12,
            color: 'rgba(255,255,255,0.35)',
          }}>
            <span>已输入 {numberInput.length} 位</span>
            <span>最多 {rowCount} 位</span>
          </div>
        </div>

        {/* 预览 */}
        {numberInput.length > 0 && (
          <div style={{
            marginBottom: 20,
            padding: '14px 18px',
            borderRadius: 12,
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>预览</div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              fontSize: 14,
            }}>
              {numberInput.split('').map((num, idx) => (
                <span key={idx} style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: RESULT_BG[NUM_TO_RESULT[num]],
                  border: `1px solid ${RESULT_COLORS[NUM_TO_RESULT[num]]}`,
                  color: RESULT_COLORS[NUM_TO_RESULT[num]],
                  fontWeight: 600,
                  minWidth: 32,
                  textAlign: 'center',
                }}>
                  {NUM_TO_RESULT[num]}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 按钮 */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => { setNumberFillVisible(false); setNumberInput(''); }}
            style={{
              flex: 1,
              padding: '14px 24px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            取消
          </button>
          <button
            onClick={handleNumberFill}
            disabled={!numberInput.trim()}
            style={{
              flex: 1,
              padding: '14px 24px',
              borderRadius: 12,
              border: 'none',
              background: numberInput.trim()
                ? 'linear-gradient(135deg, #722ed1, #531dab)'
                : 'rgba(255,255,255,0.08)',
              color: numberInput.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
              cursor: numberInput.trim() ? 'pointer' : 'not-allowed',
              fontSize: 15,
              fontWeight: 700,
              boxShadow: numberInput.trim() ? '0 4px 16px rgba(114,46,209,0.35)' : 'none',
            }}
          >
            确认填充
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default UploadPage;
