/**
 * 管理员登录弹窗组件 - 精致图标、中文全站
 */
import React, { useState } from 'react';
import { Modal, Input, App } from 'antd';
import * as api from '../../services/api';

interface LoginModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

// 精致图标
const Icons = {
  Lock: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
    </svg>
  ),
  Key: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </svg>
  ),
  Loading: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
    </svg>
  ),
};

export const LoginModal: React.FC<LoginModalProps> = ({ visible, onCancel, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  const handleLogin = async () => {
    if (!password) {
      message.warning('请输入管理密码');
      return;
    }
    
    setLoading(true);
    try {
      const res = await api.adminLogin(password);
      if (res.data && res.data.token) {
        api.setToken(res.data.token);
      }
      message.success('登录成功');
      onSuccess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // 兼容 FastAPI 返回的 {"detail": "错误原因"} 格式，否则前端提示永远是 undefined
      message.error(err.response?.data?.detail || err.response?.data?.error || err.message || '登录失败，密码错误');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    onCancel();
  };

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={handleClose}
      footer={null}
      centered
      styles={{ mask: { backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.75)' } }}
      width={400}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      closable={false}
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
          margin: '0 auto 12px',
          color: '#ffd700',
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
        style={{ height: 48, borderRadius: 10, fontSize: 14 }}
        styles={{ input: { color: '#fff' } }}
      />
      <button
        onClick={handleLogin}
        disabled={loading || !password}
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
          cursor: loading || !password ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {loading ? (
          <><Icons.Loading /> 验证中...</>
        ) : (
          <><Icons.Key /> 登录进入管理面板</>
        )}
      </button>
    </Modal>
  );
};

export default LoginModal;
