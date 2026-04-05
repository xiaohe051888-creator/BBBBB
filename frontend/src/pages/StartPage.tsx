/**
 * 启动页 - 选择桌号启动系统
 */
import React, { useState } from 'react';
import { Button, Card, Typography, Modal, Input, message, Space } from 'antd';
import { LoginOutlined, DesktopOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';

const { Title, Text } = Typography;

const StartPage: React.FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [loginVisible, setLoginVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const navigate = useNavigate();

  const handleStart = async (tableId: string) => {
    setLoading(tableId);
    try {
      await api.startSystem(tableId);
      message.success(BUTTON_TEXTS.startSuccess.primary);
      // 进入首页同时自动触发智能选模
      navigate(`/dashboard/${tableId}`);
    } catch (err: any) {
      message.error(err.response?.data?.detail || '启动失败，请重试');
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
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #0a1628 0%, #1a2332 50%, #0d1926 100%)',
    }}>
      {/* 管理员登录入口 - 右上角 */}
      <Button
        type="text"
        icon={<LoginOutlined />}
        onClick={() => setLoginVisible(true)}
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          color: 'rgba(255,255,255,0.6)',
          fontSize: 14,
        }}
      >
        登录
      </Button>

      <Card
        style={{
          width: 480,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(26,35,50,0.95)',
        }}
        styles={{ body: { padding: '48px 40px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Title level={2} style={{ color: '#fff', marginBottom: 8, fontWeight: 700 }}>
            🎰 百家乐分析预测系统
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
            选择桌号启动实时分析
          </Text>
        </div>

        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Button
            type="primary"
            size="large"
            icon={<DesktopOutlined />}
            loading={loading === '26'}
            onClick={() => handleStart('26')}
            block
            style={{
              height: 64,
              fontSize: 18,
              fontWeight: 600,
              borderRadius: 12,
              background: loading === '26' ? undefined : 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
              border: 'none',
            }}
          >
            选择 26 桌启动
          </Button>

          <Button
            type="primary"
            size="large"
            icon={<DesktopOutlined />}
            loading={loading === '27'}
            onClick={() => handleStart('27')}
            block
            style={{
              height: 64,
              fontSize: 18,
              fontWeight: 600,
              borderRadius: 12,
              background: loading === '27' ? undefined : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
              border: 'none',
            }}
          >
            选择 27 桌启动
          </Button>
        </Space>

        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            仿真验证系统 · 不涉及真实下注
          </Text>
        </div>
      </Card>

      {/* 登录弹窗 */}
      <Modal
        title="管理员登录"
        open={loginVisible}
        onOk={handleLogin}
        onCancel={() => setLoginVisible(false)}
        confirmLoading={loginLoading}
        okText="登录"
        cancelText="取消"
        centered
      >
        <div style={{ padding: '16px 0' }}>
          <Text style={{ display: 'block', marginBottom: 8 }}>请输入管理员密码</Text>
          <Input.Password
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onPressEnter={handleLogin}
            placeholder="请输入密码"
            size="large"
          />
        </div>
      </Modal>
    </div>
  );
};

// 导入按钮文案
const BUTTON_TEXTS = {
  startSuccess: {
    primary: '系统已启动',
    secondary: '当前桌台连接正常，正在进入实时分析。',
    log: '查看启动日志',
  },
};

export default StartPage;
