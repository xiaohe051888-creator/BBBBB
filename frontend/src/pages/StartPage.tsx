/**
 * 启动页 - 百家乐分析预测系统
 * 设计风格：奢华赌场风格 + 现代极简主义
 * 目标用户：小白用户，无需专业知识即可操作
 */
import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, message } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';
import { getToken } from '../services/api';

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
    const particleCount = isMobile ? 30 : 80;
    const connectionDistance = isMobile ? 80 : 120;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.6 + 0.2,
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
        ctx.shadowBlur = 15;
        ctx.shadowColor = particle.color;
        ctx.fill();

        // 光晕（移动端跳过）
        if (!isMobile) {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2);
          const gradient = ctx.createRadialGradient(
            particle.x, particle.y, 0,
            particle.x, particle.y, particle.size * 3
          );
          gradient.addColorStop(0, particle.color);
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.globalAlpha = particle.opacity * 0.3;
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
              ctx.strokeStyle = `rgba(255, 215, 0, ${0.15 * (1 - distance / connectionDistance)})`;
              ctx.lineWidth = 0.8;
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
      if (!getToken()) {
        message.warning('请先登录后再启动系统');
        setLoginVisible(true);
        setLoading(null);
        return;
      }
      await api.startSystem(tableId);
      message.success('🎉 系统已启动');
      navigate(`/dashboard/${tableId}`);
    } catch (err: any) {
      if (err.response?.status === 401) {
        message.warning('登录已过期，请重新登录');
        setLoginVisible(true);
      } else {
        message.error(err.response?.data?.detail || '启动失败，请重试');
      }
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
        className="admin-entry-btn"
        onClick={() => setLoginVisible(true)}
      >
        🔐 管理员
      </button>

      {/* 主卡片容器 */}
      <div className="start-page-card">
        {/* 标题区域 */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            fontSize: 48,
            marginBottom: 14,
            filter: 'drop-shadow(0 0 30px rgba(255, 215, 0, 0.5))',
            animation: 'pulse-glow 3s infinite',
          }}>🎰</div>

          <h1 style={{
            fontSize: 'clamp(24px, 6vw, 36px)',
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
            百家乐分析预测系统
          </h1>

          <p style={{
            marginTop: 12,
            color: 'var(--text-muted)',
            fontSize: 'clamp(13px, 3vw, 16px)',
            fontWeight: 400,
            letterSpacing: '1.5px',
          }}>
            智能三模型 · 实时五路分析 · AI深度学习
          </p>
        </div>

        {/* 功能特点展示（响应式网格） */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          marginBottom: 32,
          padding: '0 4px',
        }}>
          {[
            { icon: '🤖', text: 'AI三模型', desc: '满血预测' },
            { icon: '📊', text: '五路走势图', desc: '国际标准' },
            { icon: '⚡', text: '实时分析', desc: '150秒轮次' },
          ].map((feature, index) => (
            <div key={index} style={{
              textAlign: 'center',
              padding: '10px 6px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{feature.icon}</div>
              <div style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: 'clamp(11px, 2.5vw, 13px)',
                fontWeight: 600,
              }}>{feature.text}</div>
              <div style={{
                color: 'rgba(255,255,255,0.35)',
                fontSize: 'clamp(10px, 2vw, 11px)',
                marginTop: 2,
              }}>{feature.desc}</div>
            </div>
          ))}
        </div>

        {/* 桌台选择卡片 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 26桌 */}
          <button
            className="table-card-btn"
            disabled={loading === '26'}
            onClick={() => handleStart('26')}
            style={{
              height: 76,
              borderRadius: 16,
              border: 'none',
              outline: 'none',
              background: 'linear-gradient(135deg, #dc3545 0%, #c41d33 100%)',
              boxShadow: loading === '26'
                ? 'none'
                : '0 8px 32px rgba(220, 53, 69, 0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
              cursor: loading === '26' ? 'not-allowed' : 'pointer',
              opacity: loading === '26' ? 0.7 : 1,
            }}
          >
            <div style={{
              position: 'relative', zIndex: 1,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 14,
            }}>
              <span style={{ fontSize: 26 }}>🔴</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: '#fff', fontSize: 19, fontWeight: 700, letterSpacing: '0.5px' }}>
                  {loading === '26' ? '⏳ 启动中...' : '26 桌'}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 }}>
                  主桌 · 高频数据流
                </div>
              </div>
            </div>
          </button>

          {/* 27桌 */}
          <button
            className="table-card-btn"
            disabled={loading === '27'}
            onClick={() => handleStart('27')}
            style={{
              height: 76,
              borderRadius: 16,
              border: 'none',
              outline: 'none',
              background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
              boxShadow: loading === '27'
                ? 'none'
                : '0 8px 32px rgba(24, 144, 255, 0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
              cursor: loading === '27' ? 'not-allowed' : 'pointer',
              opacity: loading === '27' ? 0.7 : 1,
            }}
          >
            <div style={{
              position: 'relative', zIndex: 1,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 14,
            }}>
              <span style={{ fontSize: 26 }}>🔵</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: '#fff', fontSize: 19, fontWeight: 700, letterSpacing: '0.5px' }}>
                  {loading === '27' ? '⏳ 启动中...' : '27 桌'}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 }}>
                  副桌 · 备用数据源
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* 安全提示 */}
        <div style={{
          marginTop: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <SafetyCertificateOutlined style={{ color: 'rgba(82,196,26,0.7)', fontSize: 14 }} />
          <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 12, letterSpacing: '0.3px' }}>
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
        styles={{
          content: {
            borderRadius: 20,
            background: 'linear-gradient(145deg, rgba(22, 29, 42, 0.98), rgba(15, 20, 31, 0.98))',
            border: '1px solid rgba(255, 215, 0, 0.2)',
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6), 0 0 60px rgba(255, 215, 0, 0.06)',
            padding: '36px 32px 32px',
            maxWidth: 'calc(100vw - 32px)',
          },
        }}
        width={420}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700,
            color: '#fff', letterSpacing: '-0.3px',
          }}>管理员登录</h2>
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
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
            height: 52,
            borderRadius: 12,
            fontSize: 15,
          }}
          styles={{
            input: { color: '#fff' },
            suffix: { color: 'rgba(255,255,255,0.4)' },
          }}
        />

        <button
          className={`login-gold-btn ${!password || loginLoading ? '' : ''}`}
          onClick={handleLogin}
          disabled={loginLoading || !password}
          style={{
            opacity: loginLoading ? 0.7 : 1,
          }}
        >
          {loginLoading ? '⏳ 验证中...' : '🔑 登录进入管理面板'}
        </button>
      </Modal>
    </div>
  );
};

export default StartPage;
