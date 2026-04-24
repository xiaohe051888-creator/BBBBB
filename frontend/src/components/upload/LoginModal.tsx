/**
 * 管理员登录弹窗组件
 */
import React, { useState } from 'react';
import { Modal, Input } from 'antd';
import { LockIcon, KeyIcon } from './UploadIcons';

interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
  onLogin: (password: string) => Promise<void>;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  visible,
  onClose,
  onLogin,
}) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!password) return;
    setLoading(true);
    try {
      await onLogin(password);
      setPassword('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    onClose();
  };

  return (
    <Modal
      open={visible}
      onCancel={handleClose}
      footer={null}
      centered
      maskStyle={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(0,0,0,0.75)' }}
      width={400}
      style={{
        background: 'linear-gradient(145deg, #1a2332, #141b26)',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 48px rgba(0,0,0,0.4)',
        padding: '24px',
      }}
      styles={{
        header: { display: 'none' },
      }}
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
          <LockIcon />
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
        {loading ? '验证中...' : <><KeyIcon /> 登录</>}
      </button>
    </Modal>
  );
};

export default LoginModal;
