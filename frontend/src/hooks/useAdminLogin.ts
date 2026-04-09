/**
 * 管理员登录 Hook
 * 统一管理管理员登录逻辑
 */
import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';

interface UseAdminLoginOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UseAdminLoginReturn {
  /** 登录弹窗显示状态 */
  visible: boolean;
  /** 密码输入值 */
  password: string;
  /** 登录中状态 */
  loading: boolean;
  /** 打开登录弹窗 */
  openLogin: () => void;
  /** 关闭登录弹窗 */
  closeLogin: () => void;
  /** 设置密码 */
  setPassword: (password: string) => void;
  /** 执行登录 */
  handleLogin: () => Promise<void>;
}

/**
 * 管理员登录 Hook
 * @param options 可选配置
 * @returns 登录状态和操作方法
 */
export const useAdminLogin = (
  options: UseAdminLoginOptions = {}
): UseAdminLoginReturn => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const openLogin = useCallback(() => {
    setVisible(true);
  }, []);

  const closeLogin = useCallback(() => {
    setVisible(false);
    setPassword('');
  }, []);

  const handleLogin = useCallback(async () => {
    if (!password) {
      message.warning('请输入密码');
      return;
    }

    setLoading(true);
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

      setVisible(false);
      setPassword('');
      options.onSuccess?.();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '登录失败';
      message.error(errorMsg);
      if (err instanceof Error) {
        options.onError?.(err);
      }
    } finally {
      setLoading(false);
    }
  }, [password, navigate, options]);

  return {
    visible,
    password,
    loading,
    openLogin,
    closeLogin,
    setPassword,
    handleLogin,
  };
};

export default useAdminLogin;
