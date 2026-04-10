/**
 * 启动页 - 智能AI百家乐分析系统（手动模式）
 * 设计风格：奢华赌场风格 + 现代极简主义
 * 全面优化：自适应布局、精致图标、中文全站
 */
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';

// 精致图标组件
const Icons = {
  Admin: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
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
  Shield: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
    </svg>
  ),
  AI: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
  ),
  Chart: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3v18h18"/>
      <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
    </svg>
  ),
  Edit: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  Table26: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="#ff4d4f">
      <circle cx="12" cy="12" r="10"/>
      <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">26</text>
    </svg>
  ),
  Table27: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="#1890ff">
      <circle cx="12" cy="12" r="10"/>
      <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">27</text>
    </svg>
  ),
  Casino: () => (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
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
  Loading: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
    </svg>
  ),
};

const StartPage: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [loginVisible, setLoginVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 粒子背景动画（移动端降低粒子数）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isMobile = window.innerWidth <= 768;
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    interface Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      color: string;
    }

    const particles: Particle[] = [];
    const particleCount = isMobile ? 25 : 60;
    const connectionDistance = isMobile ? 60 : 100;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2.5 + 0.5,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: (Math.random() - 0.5) * 0.4,
        opacity: Math.random() * 0.5 + 0.15,
        color: ['#ffd700', '#ff4d4f', '#1890ff', '#52c41a'][Math.floor(Math.random() * 4)],
      });
    }

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x < 0 || particle.x > canvas.width) particle.speedX *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.speedY *= -1;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.opacity;
        ctx.shadowBlur = 12;
        ctx.shadowColor = particle.color;
        ctx.fill();

        // 光晕（移动端跳过）
        if (!isMobile) {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * 2.5, 0, Math.PI * 2);
          const gradient = ctx.createRadialGradient(
            particle.x, particle.y, 0,
            particle.x, particle.y, particle.size * 2.5
          );
          gradient.addColorStop(0, particle.color);
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.globalAlpha = particle.opacity * 0.2;
          ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      });

      // 连线（移动端跳过）
      if (!isMobile) {
        particles.forEach((p1, i) => {
          particles.slice(i + 1).forEach((p2) => {
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < connectionDistance) {
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `rgba(255, 215, 0, ${0.12 * (1 - distance / connectionDistance)})`;
              ctx.lineWidth = 0.6;
              ctx.stroke();
            }
          });
        });
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const handleStart = async (tableId: string) => {
    setLoading(tableId);
    try {
      await api.getHealthScore(tableId);
      message.success(`${tableId}桌已就绪`);
      navigate(`/upload?table=${tableId}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '连接失败，请检查后端服务';
      message.error(errorMsg);
    } finally {
      setLoading(null);
    }
  };

  const handleLogin = async () => {
    if (!password) {
      message.warning('请输入密码');
      return;
    }
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
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #0a0e17 0%, #111927 30%, #0f1623 60%, #0a101c 100%)',
    }}>
      {/* 粒子动画背景 */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
      />

      {/* 背景渐变叠加层 */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: `
          radial-gradient(circle at 20% 50%, rgba(255, 77, 79, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(24, 144, 255, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 50% 80%, rgba(255, 215, 0, 0.06) 0%, transparent 50%)
        `,
        zIndex: 1,
      }} />

      {/* 管理员登录入口 */}
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

      {/* 主卡片容器 - 自适应 */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        width: '90%',
        maxWidth: 420,
        padding: 'clamp(24px, 6vw, 40px)',
        borderRadius: 24,
        background: 'linear-gradient(145deg, rgba(22,29,42,0.95), rgba(15,21,33,0.95))',
        border: '1px solid rgba(255,215,0,0.1)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
      }}>
        {/* 标题区域 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            marginBottom: 16,
            filter: 'drop-shadow(0 0 30px rgba(255, 215, 0, 0.4))',
          }}>
            <Icons.Casino />
          </div>

          <h1 style={{
            fontSize: 'clamp(22px, 6vw, 32px)',
            fontWeight: 800,
            margin: 0,
            background: 'linear-gradient(135deg, #ffd700 0%, #fff 40%, #ffd700 70%, #b8860b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundSize: '200% auto',
            animation: 'shimmer-text 3s linear infinite',
            letterSpacing: '-0.5px',
            lineHeight: '1.2',
          }}>
            智能AI
          </h1>
          <p style={{
            marginTop: 8,
            color: 'rgba(255,255,255,0.5)',
            fontSize: 'clamp(11px, 3vw, 14px)',
            fontWeight: 400,
            letterSpacing: '1px',
          }}>
            百家乐分析预测系统
          </p>
          <div style={{
            marginTop: 6,
            fontSize: 10,
            color: 'rgba(255,255,255,0.3)',
          }}>
            版本 2.3.0
          </div>
        </div>

        {/* 功能特点展示（响应式网格） */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginBottom: 28,
        }}>
          {[
            { icon: <Icons.AI />, text: 'AI三模型', desc: '满血预测' },
            { icon: <Icons.Chart />, text: '五路走势图', desc: '国际标准' },
            { icon: <Icons.Edit />, text: '手动输入', desc: '灵活上传' },
          ].map((feature, index) => (
            <div key={index} style={{
              textAlign: 'center',
              padding: '12px 8px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ 
                fontSize: 20, 
                marginBottom: 6,
                color: 'rgba(255,215,0,0.8)',
                display: 'flex',
                justifyContent: 'center',
              }}>{feature.icon}</div>
              <div style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: 'clamp(10px, 2.5vw, 12px)',
                fontWeight: 600,
              }}>{feature.text}</div>
              <div style={{
                color: 'rgba(255,255,255,0.35)',
                fontSize: 'clamp(9px, 2vw, 10px)',
                marginTop: 2,
              }}>{feature.desc}</div>
            </div>
          ))}
        </div>

        {/* 桌台选择卡片 - 自适应 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 26桌 */}
          <button
            disabled={loading === '26'}
            onClick={() => handleStart('26')}
            style={{
              height: 72,
              borderRadius: 14,
              border: 'none',
              outline: 'none',
              background: loading === '26' 
                ? 'linear-gradient(135deg, #9e2a38 0%, #7a1a26 100%)'
                : 'linear-gradient(135deg, #dc3545 0%, #c41d33 100%)',
              boxShadow: loading === '26'
                ? 'none'
                : '0 6px 24px rgba(220, 53, 69, 0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
              cursor: loading === '26' ? 'not-allowed' : 'pointer',
              opacity: loading === '26' ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              transition: 'all 0.2s',
            }}
          >
            <Icons.Table26 />
            <div style={{ textAlign: 'left' }}>
              <div style={{ 
                color: '#fff', 
                fontSize: 17, 
                fontWeight: 700, 
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                {loading === '26' ? (
                  <>
                    <Icons.Loading />
                    加载中...
                  </>
                ) : '26 桌'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }}>
                点击进入 · 手动上传开奖记录
              </div>
            </div>
          </button>

          {/* 27桌 */}
          <button
            disabled={loading === '27'}
            onClick={() => handleStart('27')}
            style={{
              height: 72,
              borderRadius: 14,
              border: 'none',
              outline: 'none',
              background: loading === '27'
                ? 'linear-gradient(135deg, #0e5aa7 0%, #0a4080 100%)'
                : 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
              boxShadow: loading === '27'
                ? 'none'
                : '0 6px 24px rgba(24, 144, 255, 0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
              cursor: loading === '27' ? 'not-allowed' : 'pointer',
              opacity: loading === '27' ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              transition: 'all 0.2s',
            }}
          >
            <Icons.Table27 />
            <div style={{ textAlign: 'left' }}>
              <div style={{ 
                color: '#fff', 
                fontSize: 17, 
                fontWeight: 700, 
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                {loading === '27' ? (
                  <>
                    <Icons.Loading />
                    加载中...
                  </>
                ) : '27 桌'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }}>
                点击进入 · 手动上传开奖记录
              </div>
            </div>
          </button>
        </div>

        {/* 安全提示 */}
        <div style={{
          marginTop: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}>
          <Icons.Shield />
          <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, letterSpacing: '0.3px' }}>
            仿真验证系统 · 不涉及真实下注 · 数据仅供学习研究
          </span>
        </div>
      </div>

      {/* 登录弹窗 */}
      <Modal
        open={loginVisible}
        onCancel={() => {
          setLoginVisible(false);
          setPassword('');
        }}
        footer={null}
        centered
        closable={true}
        maskStyle={{
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
        }}
        width={400}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
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
          <h2 style={{
            margin: 0, fontSize: 18, fontWeight: 700,
            color: '#fff', letterSpacing: '-0.3px',
          }}>管理员登录</h2>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
            仅限授权人员访问
          </p>
        </div>

        <Input.Password
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onPressEnter={handleLogin}
          placeholder="请输入管理员密码"
          size="large"
          autoFocus
          style={{
            height: 48,
            borderRadius: 10,
            fontSize: 14,
          }}
          styles={{
            input: { color: '#fff' },
            suffix: { color: 'rgba(255,255,255,0.4)' },
          }}
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
          {loginLoading ? '验证中...' : <><Icons.Key /> 登录进入管理面板</>}
        </button>
      </Modal>
    </div>
  );
};

export default StartPage;
