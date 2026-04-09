/**
 * 管理员登录弹窗组件
 */
import React from 'react';
import { Modal, Input } from 'antd';

interface LoginModalProps {
  visible: boolean;
  onCancel: () => void;
  password: string;
  setPassword: (pwd: string) => void;
  onLogin: () => void;
  loading: boolean;
}

const LoginModal: React.FC<LoginModalProps> = ({
  visible,
  onCancel,
  password,
  setPassword,
  onLogin,
  loading,
}) => {
  return (
    <Modal
      open={visible}
      onCancel={onCancel}
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
        onPressEnter={onLogin}
        placeholder="请输入管理员密码"
        size="large"
        autoFocus
        style={{ height: 50, borderRadius: 12, fontSize: 15 }}
        styles={{ input: { color: '#fff' } }}
      />
      <button
        className="login-gold-btn"
        onClick={onLogin}
        disabled={loading || !password}
        style={{ opacity: loading ? 0.7 : 1, marginTop: 16 }}
      >
        {loading ? '⏳ 验证中...' : '🔑 登录进入管理面板'}
      </button>
    </Modal>
  );
};

export default LoginModal;
