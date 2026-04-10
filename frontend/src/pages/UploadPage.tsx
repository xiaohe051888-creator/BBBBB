/**
 * 数据上传页面 - 智能AI百家乐分析系统（手动模式）
 * 全面优化UI/UX：自适应布局、精致图标、中文全站
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal, Input, Tooltip } from 'antd';
import * as api from '../services/api';
import { ParticleBackground } from '../components/upload';

type GameResult = '庄' | '闲' | '和' | '';

// 快捷序列填充
const QUICK_FILLS: { label: string; pattern: GameResult[]; icon: React.ReactNode }[] = [
  { 
    label: '全庄', 
    pattern: ['庄'],
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff4d4f">
        <circle cx="12" cy="12" r="10"/>
      </svg>
    )
  },
  { 
    label: '全闲', 
    pattern: ['闲'],
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#1890ff">
        <circle cx="12" cy="12" r="10"/>
      </svg>
    )
  },
  { 
    label: '交替', 
    pattern: ['庄', '闲'],
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 12h16M12 4v16"/>
      </svg>
    )
  },
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

// 精致图标组件
const Icons = {
  Admin: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
    </svg>
  ),
  Upload: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
    </svg>
  ),
  Dashboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
    </svg>
  ),
  Clear: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
    </svg>
  ),
  NumberFill: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-4H8v-2h2V9h2v2h2v2h-2v4z"/>
    </svg>
  ),
  Lock: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
    </svg>
  ),
  Key: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </svg>
  ),
  Info: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </svg>
  ),
  Minus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13H5v-2h14v2z"/>
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </svg>
  ),
  Check: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  Close: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  ),
  Casino: () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="chipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffd700"/>
          <stop offset="50%" stopColor="#ffed4e"/>
          <stop offset="100%" stopColor="#d4af37"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#chipGrad)" stroke="#b8860b" strokeWidth="0.5"/>
      <circle cx="12" cy="12" r="7" fill="none" stroke="#b8860b" strokeWidth="0.5"/>
      <circle cx="12" cy="12" r="4" fill="#fff" fillOpacity="0.3"/>
      <rect x="11" y="2" width="2" height="4" fill="#b8860b"/>
      <rect x="11" y="18" width="2" height="4" fill="#b8860b"/>
      <rect x="2" y="11" width="4" height="2" fill="#b8860b"/>
      <rect x="18" y="11" width="4" height="2" fill="#b8860b"/>
    </svg>
  ),
};

const DEFAULT_ROWS = 66;
const BEAD_ROWS = 6;
const BEAD_COLS = 11; // 优化为11列，更适合自适应

const UploadPage: React.FC = () => {
  const navigate = useNavigate();

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
    Modal.confirm({
      title: '确认清空',
      content: '确定要清空所有已填写的数据吗？',
      okText: '确认清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => setGames(Array(rowCount).fill('')),
    });
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
      okButtonProps: { 
        style: { 
          background: 'linear-gradient(135deg,#ffd700,#f0b90b)', 
          borderColor: '#ffd700', 
          color: '#000', 
          fontWeight: 700 
        } 
      },
      centered: true,
      maskStyle: { backdropFilter: 'blur(8px)' },
      onOk: async () => {
        setUploading(true);
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res = await api.uploadGameResults(tableId, validGames as any, bootNumber);
          if (res.data.success) {
            message.success(`上传成功！${res.data.uploaded}局数据已入库，AI分析进行中...`);
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
      padding: '16px',
    }}>
      {/* 粒子背景 */}
      <ParticleBackground />
      
      {/* 背景光晕 */}
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 0, 
        pointerEvents: 'none',
        background: `radial-gradient(circle at 20% 50%, rgba(255,77,79,0.06) 0%, transparent 50%),
                     radial-gradient(circle at 80% 20%, rgba(24,144,255,0.06) 0%, transparent 50%),
                     radial-gradient(circle at 50% 80%, rgba(255,215,0,0.04) 0%, transparent 50%)`
      }} />

      {/* 管理员按钮 */}
      <button
        onClick={() => setLoginVisible(true)}
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 10,
          padding: '8px 16px',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(22,29,42,0.8)',
          color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s',
        }}
      >
        <Icons.Admin />
        管理员
      </button>

      {/* 主卡片 */}
      <div style={{ 
        position: 'relative', 
        zIndex: 2, 
        width: '100%', 
        maxWidth: 720, 
        marginTop: 8,
        padding: '0 8px',
      }}>
        
        {/* 标题区 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ 
            marginBottom: 12,
            filter: 'drop-shadow(0 0 24px rgba(255,215,0,0.4))',
          }}>
            <Icons.Casino />
          </div>
          <h1 style={{
            fontSize: 'clamp(20px, 5vw, 28px)',
            fontWeight: 800,
            margin: 0,
            background: 'linear-gradient(135deg, #ffd700 0%, #fff 40%, #ffd700 70%, #b8860b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundSize: '200% auto',
            animation: 'shimmer-text 3s linear infinite',
          }}>
            智能AI
          </h1>
          <p style={{ 
            marginTop: 6, 
            color: 'rgba(255,255,255,0.5)', 
            fontSize: 'clamp(11px, 2.5vw, 13px)', 
            letterSpacing: '1px' 
          }}>
            百家乐分析预测系统 · 手动上传 · AI三模型分析
          </p>
          <div style={{
            marginTop: 8,
            fontSize: 11,
            color: 'rgba(255,255,255,0.3)',
          }}>
            版本 2.3.0
          </div>
        </div>

        {/* 控制栏 - 自适应布局 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '16px 20px',
          borderRadius: 16,
          marginBottom: 16,
          background: 'linear-gradient(145deg, rgba(22,29,42,0.9), rgba(15,21,33,0.9))',
          border: '1px solid rgba(255,215,0,0.1)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
          {/* 第一行：桌台 + 局数 - 自适应 */}
          <div style={{ 
            display: 'flex', 
            gap: 16, 
            flexWrap: 'wrap', 
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* 桌台选择 */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>桌台</span>
              {(['26', '27'] as const).map(t => (
                <button 
                  key={t} 
                  onClick={() => setTableId(t)} 
                  style={{
                    padding: '6px 16px',
                    borderRadius: 10,
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 14,
                    background: tableId === t
                      ? (t === '26' ? 'linear-gradient(135deg,#ff4d4f,#dc3545)' : 'linear-gradient(135deg,#1890ff,#096dd9)')
                      : 'rgba(255,255,255,0.06)',
                    color: tableId === t ? '#fff' : 'rgba(255,255,255,0.5)',
                    boxShadow: tableId === t ? (t === '26' ? '0 4px 16px rgba(255,77,79,0.35)' : '0 4px 16px rgba(24,144,255,0.35)') : 'none',
                    transition: 'all 0.2s',
                    minWidth: 60,
                  }}
                >
                  {t}桌
                </button>
              ))}
            </div>

            {/* 局数控制 */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>局数</span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px',
                borderRadius: 10,
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <button 
                  onClick={() => handleRowCountChange(rowCount - 1)} 
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: 'none',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  <Icons.Minus />
                </button>
                <span style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#ffd700',
                  minWidth: 32,
                  textAlign: 'center',
                }}>{rowCount}</span>
                <button 
                  onClick={() => handleRowCountChange(rowCount + 1)} 
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: 'none',
                    background: 'rgba(255,255,255,0.08)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  <Icons.Plus />
                </button>
              </div>
              <button 
                onClick={() => handleRowCountChange(66)} 
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,215,0,0.25)',
                  background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,215,0,0.04))',
                  color: '#ffd700',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  transition: 'all 0.15s',
                }}
              >
                满66局
              </button>
            </div>
          </div>

          {/* 第二行：快捷填充 + 操作按钮 - 自适应 */}
          <div style={{ 
            display: 'flex', 
            gap: 10, 
            flexWrap: 'wrap', 
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* 快捷填充 */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>快捷</span>
              {QUICK_FILLS.map(f => (
                <button 
                  key={f.label} 
                  onClick={() => handleQuickFill(f.pattern)} 
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.65)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {f.icon}
                  {f.label}
                </button>
              ))}
            </div>

            {/* 分隔线 */}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

            {/* 数字填充按钮 */}
            <button
              onClick={() => setNumberFillVisible(true)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid rgba(114,46,209,0.4)',
                background: 'linear-gradient(135deg, rgba(114,46,209,0.15), rgba(114,46,209,0.05))',
                color: '#b37feb',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s',
              }}
            >
              <Icons.NumberFill />
              数字填充
            </button>

            {/* 清空按钮 */}
            <button 
              onClick={handleClear} 
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255,77,79,0.3)',
                background: 'rgba(255,77,79,0.06)',
                color: '#ff7875',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s',
              }}
            >
              <Icons.Clear />
              清空
            </button>
          </div>
        </div>

        {/* 统计条 - 自适应 */}
        <div style={{
          display: 'flex',
          gap: 12,
          padding: '12px 16px',
          borderRadius: 12,
          marginBottom: 16,
          background: 'linear-gradient(90deg, rgba(22,29,42,0.8), rgba(30,40,60,0.8))',
          border: '1px solid rgba(255,255,255,0.06)',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 总进度 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: `conic-gradient(#ffd700 ${filled / rowCount * 360}deg, rgba(255,255,255,0.08) 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(15,21,33,0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ffd700' }}>{filled}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>已填/总局</span>
                <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{filled}/{rowCount}</span>
              </div>
            </div>

            {/* 分隔线 */}
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />

            {/* 各结果统计 */}
            <div style={{ display: 'flex', gap: 12 }}>
              <Tooltip title="庄">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'rgba(255,77,79,0.08)',
                  border: '1px solid rgba(255,77,79,0.15)',
                }}>
                  <span style={{ fontSize: 11, color: '#ff7875' }}>庄</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#ff4d4f' }}>{bankerCount}</span>
                </div>
              </Tooltip>
              <Tooltip title="闲">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'rgba(24,144,255,0.08)',
                  border: '1px solid rgba(24,144,255,0.15)',
                }}>
                  <span style={{ fontSize: 11, color: '#69c0ff' }}>闲</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1890ff' }}>{playerCount}</span>
                </div>
              </Tooltip>
              <Tooltip title="和">
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'rgba(82,196,26,0.08)',
                  border: '1px solid rgba(82,196,26,0.15)',
                }}>
                  <span style={{ fontSize: 11, color: '#95de64' }}>和</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#52c41a' }}>{tieCount}</span>
                </div>
              </Tooltip>
            </div>
          </div>

          {/* 操作提示 */}
          <Tooltip title="点击圆圈切换：庄 → 闲 → 和 → 空">
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <Icons.Info />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                点击圆圈切换结果
              </span>
            </div>
          </Tooltip>
        </div>

        {/* 珠盘路面板 - 自适应网格 */}
        <div style={{
          padding: '20px 16px',
          borderRadius: 20,
          background: 'linear-gradient(145deg, rgba(22,29,42,0.9), rgba(15,21,33,0.9))',
          border: '1px solid rgba(255,215,0,0.08)',
          marginBottom: 20,
          boxShadow: '0 12px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}>
          {/* 珠盘路网格 - 响应式 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${BEAD_COLS}, 1fr)`,
            gap: 'clamp(4px, 1vw, 8px)',
            maxWidth: '100%',
          }}>
            {Array.from({ length: BEAD_COLS * BEAD_ROWS }).map((_, idx) => {
              const result = games[idx] || '';
              const gameNumber = idx + 1;
              const isDisabled = idx >= rowCount;

              return (
                <button
                  key={idx}
                  onClick={() => !isDisabled && handleCellClick(idx)}
                  disabled={isDisabled}
                  style={{
                    aspectRatio: '1',
                    minWidth: 0,
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
                    opacity: isDisabled ? 0.25 : 1,
                    boxShadow: result
                      ? `0 4px 16px ${RESULT_COLORS[result]}30, inset 0 1px 0 rgba(255,255,255,0.1)`
                      : '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
                  }}
                >
                  {result ? (
                    <span style={{
                      fontSize: 'clamp(12px, 3vw, 18px)',
                      fontWeight: 800,
                      color: RESULT_COLORS[result],
                      textShadow: `0 0 12px ${RESULT_COLORS[result]}60`,
                    }}>
                      {result}
                    </span>
                  ) : (
                    <span style={{
                      fontSize: isDisabled ? 'clamp(10px, 2vw, 12px)' : 'clamp(11px, 2.5vw, 14px)',
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

          {/* 列号标注 - 隐藏在小屏幕上 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${BEAD_COLS}, 1fr)`,
            gap: 'clamp(4px, 1vw, 8px)',
            marginTop: 8,
          } as React.CSSProperties}>
            {Array.from({ length: BEAD_COLS }).map((_, colIdx) => (
              <div key={colIdx} style={{
                textAlign: 'center',
                fontSize: 10,
                color: 'rgba(255,255,255,0.2)',
                fontWeight: 500,
              }}>
                {colIdx + 1}
              </div>
            ))}
          </div>
        </div>

        {/* 操作按钮 - 自适应 */}
        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
          flexWrap: 'wrap',
          padding: '20px',
          borderRadius: 16,
          background: 'linear-gradient(145deg, rgba(22,29,42,0.6), rgba(15,21,33,0.6))',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          {/* 查看仪表盘（不上传） */}
          <button
            onClick={() => navigate(`/dashboard/${tableId}`)}
            style={{
              padding: '14px 28px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
              color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              minWidth: 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
          >
            <Icons.Dashboard />
            查看仪表盘
          </button>

          {/* 确认上传 */}
          <button
            onClick={handleUpload}
            disabled={uploading || filled === 0}
            style={{
              padding: '14px 32px',
              borderRadius: 12,
              border: 'none',
              background: filled === 0
                ? 'rgba(255,255,255,0.06)'
                : 'linear-gradient(135deg, #ffd700 0%, #f0b90b 50%, #d4a017 100%)',
              color: filled === 0 ? 'rgba(255,255,255,0.3)' : '#000',
              cursor: filled === 0 ? 'not-allowed' : 'pointer',
              fontSize: 15,
              fontWeight: 800,
              minWidth: 180,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: filled > 0 ? '0 8px 32px rgba(255,215,0,0.4)' : 'none',
              transition: 'all 0.2s',
              opacity: uploading ? 0.7 : 1,
              letterSpacing: '0.5px',
            }}
          >
            {uploading ? (
              <>
                <span>上传中...</span>
              </>
            ) : (
              <>
                <Icons.Upload />
                确认上传 ({filled}局)
              </>
            )}
          </button>
        </div>

        {/* 安全提示 */}
        <div style={{
          marginTop: 24,
          textAlign: 'center',
          padding: '10px 20px',
          borderRadius: 10,
          background: 'rgba(82,196,26,0.06)',
          border: '1px solid rgba(82,196,26,0.12)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          margin: '24px auto 0',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(82,196,26,0.7)">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '0.3px' }}>
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
        width={400}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ 
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.08))',
            border: '1px solid rgba(255,215,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Icons.Lock />
          </div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff' }}>管理员登录</h2>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>仅限授权人员访问</p>
        </div>
        <Input.Password
          value={password}
          onChange={e => setPassword(e.target.value)}
          onPressEnter={handleLogin}
          placeholder="请输入管理员密码"
          size="large"
          autoFocus
          style={{ height: 46, borderRadius: 10, fontSize: 14 }}
        />
        <button
          onClick={handleLogin}
          disabled={loginLoading || !password}
          style={{
            width: '100%',
            marginTop: 16,
            padding: '14px 24px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #ffd700, #f0b90b)',
            color: '#000',
            fontSize: 15,
            fontWeight: 700,
            cursor: loginLoading || !password ? 'not-allowed' : 'pointer',
            opacity: loginLoading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loginLoading ? '验证中...' : <><Icons.Key /> 登录</>}
        </button>
      </Modal>

      {/* 数字填充弹窗 */}
      <Modal
        open={numberFillVisible}
        onCancel={() => { setNumberFillVisible(false); setNumberInput(''); }}
        footer={null}
        centered
        maskStyle={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.75)' }}
        width={440}
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(114,46,209,0.2), rgba(114,46,209,0.08))',
            border: '1px solid rgba(114,46,209,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <Icons.NumberFill />
          </div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff' }}>数字填充</h2>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
            输入数字序列快速填充开奖结果
          </p>
        </div>

        {/* 说明卡片 */}
        <div style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
          marginBottom: 16,
          padding: '10px 14px',
          borderRadius: 10,
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.06)',
          flexWrap: 'wrap',
        }}>
          {[
            { num: '1', label: '庄', color: '#ff4d4f' },
            { num: '2', label: '闲', color: '#1890ff' },
            { num: '3', label: '和', color: '#52c41a' },
          ].map(item => (
            <div key={item.num} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                background: `${item.color}20`,
                border: `1px solid ${item.color}50`,
                color: item.color,
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>{item.num}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>= {item.label}</span>
            </div>
          ))}
        </div>

        {/* 输入框 */}
        <div style={{ marginBottom: 16 }}>
          <Input
            value={numberInput}
            onChange={e => {
              const val = e.target.value.replace(/[^123]/g, '').slice(0, rowCount);
              setNumberInput(val);
            }}
            onPressEnter={handleNumberFill}
            placeholder={`请输入数字序列（最多${rowCount}位）`}
            size="large"
            autoFocus
            style={{
              height: 50,
              borderRadius: 10,
              fontSize: 16,
              fontFamily: 'monospace',
              letterSpacing: '2px',
              textAlign: 'center',
            }}
            styles={{ input: { color: '#fff' } }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 8,
            fontSize: 11,
            color: 'rgba(255,255,255,0.35)',
          }}>
            <span>已输入 {numberInput.length} 位</span>
            <span>最多 {rowCount} 位</span>
          </div>
        </div>

        {/* 预览 */}
        {numberInput.length > 0 && (
          <div style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>预览</div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 5,
              fontSize: 12,
            }}>
              {numberInput.split('').map((num, idx) => (
                <span key={idx} style={{
                  padding: '3px 8px',
                  borderRadius: 5,
                  background: RESULT_BG[NUM_TO_RESULT[num]],
                  border: `1px solid ${RESULT_COLORS[NUM_TO_RESULT[num]]}`,
                  color: RESULT_COLORS[NUM_TO_RESULT[num]],
                  fontWeight: 600,
                  minWidth: 26,
                  textAlign: 'center',
                }}>
                  {NUM_TO_RESULT[num]}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 按钮 */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { setNumberFillVisible(false); setNumberInput(''); }}
            style={{
              flex: 1,
              padding: '12px 20px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: 14,
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
              padding: '12px 20px',
              borderRadius: 10,
              border: 'none',
              background: numberInput.trim()
                ? 'linear-gradient(135deg, #722ed1, #531dab)'
                : 'rgba(255,255,255,0.08)',
              color: numberInput.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
              cursor: numberInput.trim() ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 700,
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
