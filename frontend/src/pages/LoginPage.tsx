import React, { useMemo, useState } from 'react';
import { Alert, App, Button, Card, Input, Space } from 'antd';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../services/api';

const LoginPage: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const expired = searchParams.get('session_expired') === 'true' || searchParams.get('session_expired') === '1';

  const fromPath = useMemo(() => {
    const state = location.state as { from?: string } | null;
    return state?.from || '/dashboard';
  }, [location.state]);

  const onSubmit = async () => {
    if (!username.trim() || !password) {
      message.warning('请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      const res = await api.userLogin(username.trim(), password);
      if (res.data?.token) {
        api.setToken(res.data.token);
      }
      message.success('登录成功');
      navigate(fromPath, { replace: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      message.error(err.response?.data?.detail || err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 'min(420px, 100%)' }}>
        {expired && (
          <Alert
            type="warning"
            showIcon
            closable
            message="登录已过期"
            description="请重新登录后再进入系统。"
            style={{ marginBottom: 12 }}
            onClose={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('session_expired');
              setSearchParams(next, { replace: true });
            }}
          />
        )}
        <Card
          className="page-auth-card mobile-status-card"
          title={<div style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>用户登录</div>}
          styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.08)' } }}
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
              autoFocus
              onPressEnter={onSubmit}
            />
            <Input.Password
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              onPressEnter={onSubmit}
            />
            <Button type="primary" block onClick={onSubmit} loading={loading} disabled={!username.trim() || !password}>
              登录
            </Button>
            <Button block onClick={() => navigate('/admin')} disabled={loading}>
              管理员入口
            </Button>
          </Space>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
