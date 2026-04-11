/**
 * 启动页 - 智能AI百家乐分析系统（手动模式）
 * 设计风格：奢华赌场风格 + 现代极简主义
 * 全面优化：自适应布局、精致图标、中文全站
 */
import React, { useState } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';
import { useSystemDiagnostics } from '../hooks/useSystemDiagnostics';
import {
  Icons,
  ParticleBackground,
  FeatureGrid,
  TableButton,
  LoginModal,
} from '../components/start';

const StartPage: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [loginVisible, setLoginVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const navigate = useNavigate();

  // 系统诊断（使用默认桌号，因为StartPage没有选择桌号）
  const { addIssue } = useSystemDiagnostics({ tableId: '26' });

  const handleStart = async (tableId: string) => {
    setLoading(tableId);
    try {
      await api.getHealthScore(tableId);
      message.success(`${tableId}桌已就绪`);
      navigate(`/upload?table=${tableId}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '连接失败，请检查后端服务';
      message.error(errorMsg);
      // 记录错误到系统状态面板
      addIssue({
        level: 'critical',
        title: '后端连接失败',
        detail: `无法连接到${tableId}桌后端服务: ${errorMsg}`,
        source: 'system',
      });
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
      // 记录错误到系统状态面板
      addIssue({
        level: 'warning',
        title: '管理员登录失败',
        detail: `登录失败: ${errorMsg}`,
        source: 'system',
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCancelLogin = () => {
    setLoginVisible(false);
    setPassword('');
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
      <ParticleBackground />

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
        <FeatureGrid />

        {/* 桌台选择卡片 - 自适应 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TableButton
            tableId="26"
            loading={loading === '26'}
            onClick={() => handleStart('26')}
            variant="red"
          />
          <TableButton
            tableId="27"
            loading={loading === '27'}
            onClick={() => handleStart('27')}
            variant="blue"
          />
        </div>

      </div>

      {/* 登录弹窗 */}
      <LoginModal
        open={loginVisible}
        password={password}
        loading={loginLoading}
        onPasswordChange={setPassword}
        onLogin={handleLogin}
        onCancel={handleCancelLogin}
      />
    </div>
  );
};

export default StartPage;
