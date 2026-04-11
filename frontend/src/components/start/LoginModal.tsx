/**
 * 管理员登录弹窗组件
 */
import React from 'react';
import { Modal, Input } from 'antd';
import { Icons } from './StartIcons';

interface LoginModalProps {
  open: boolean;
  password: string;
  loading: boolean;
  onPasswordChange: (value: string) => void;
  onLogin: () => void;
  onCancel: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  open,
  password,
  loading,
  onPasswordChange,
  onLogin,
  onCancel,
}) => {
  return (
    <Modal
      open={open}
      onCancel={onCancel}
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
        onChange={(e) => onPasswordChange(e.target.value)}
        onPressEnter={onLogin}
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
        onClick={onLogin}
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
        {loading ? '验证中...' : <><Icons.Key /> 登录进入管理面板</>}
      </button>
    </Modal>
  );
};
