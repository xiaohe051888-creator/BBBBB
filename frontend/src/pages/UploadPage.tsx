/**
 * 数据上传页面 - 智能AI百家乐分析系统（手动模式）
 * 全面优化UI/UX：自适应布局、精致图标、中文全站
 */
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { message, Modal } from 'antd';
import * as api from '../services/api';
import type { GameResult } from '../components/upload';
import {
  ParticleBackground,
  BeadRoadGrid,
  NumberFillModal,
  LoginModal,
  StatsBar,
  ControlBar,
  UploadArea,
  ValidationPanel,
  DEFAULT_ROWS,
  NUM_TO_RESULT,
  UploadIcons,
} from '../components/upload';
import { useSystemDiagnostics } from '../hooks/useSystemDiagnostics';

// UploadPage组件暂不需要外部props
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface UploadPageProps {
  // 可选的外部props
}

const UploadPage: React.FC<UploadPageProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isNewBoot = location.state?.isNewBoot || false;

  // 72局数据
  const [games, setGames] = useState<GameResult[]>(Array(DEFAULT_ROWS).fill(''));
  const [rowCount, setRowCount] = useState(DEFAULT_ROWS);
    const [uploading, setUploading] = useState(false);

  // 系统诊断
  const { addIssue } = useSystemDiagnostics({});

  // 登录弹窗
  const [loginVisible, setLoginVisible] = useState(false);

  // 数字填充弹窗
  const [numberFillVisible, setNumberFillVisible] = useState(false);

  // 统计
  const filled = games.filter(g => g !== '').length;
  const bankerCount = games.filter(g => g === '庄').length;
  const playerCount = games.filter(g => g === '闲').length;
  const tieCount = games.filter(g => g === '和').length;

  // 调整行数
  const handleRowCountChange = (n: number) => {
    const count = Math.max(1, Math.min(72, n));
    setRowCount(count);
    setGames(prev => {
      const next = [...prev];
      while (next.length < count) next.push('');
      return next.slice(0, count);
    });
  };

  // 点击切换结果
  const handleCellClick = (idx: number) => {
    setGames(prev => {
      const next = [...prev];
      const cycle: GameResult[] = ['庄', '闲', '和', ''];
      const cur = next[idx];
      const ci = cycle.indexOf(cur);
      next[idx] = cycle[(ci + 1) % cycle.length];
      return next;
    });
  };

  // 快捷填充
  const handleQuickFill = (pattern: GameResult[]) => {
    setGames(prev => prev.map((_, i) => pattern[i % pattern.length]));
  };

  // 清空
  const handleClear = () => {
    Modal.confirm({
      title: (
        <span style={{ color: '#ff4d4f', fontSize: 16, fontWeight: 600 }}>
          确认清空数据
        </span>
      ),
      content: (
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>
          <p style={{ margin: '0 0 12px 0' }}>确定要清空所有已填写的数据吗？</p>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            此操作不可撤销，已填写的 {filled} 局数据将被清除
          </p>
        </div>
      ),
      okText: '确认清空',
      cancelText: '取消',
      okButtonProps: {
        danger: true,
        style: {
          background: 'linear-gradient(135deg,#ff4d4f,#ff7875)',
          borderColor: '#ff4d4f',
          color: '#fff',
          fontWeight: 600,
        },
      },
      cancelButtonProps: {
        style: {
          background: 'rgba(255,255,255,0.1)',
          borderColor: 'rgba(255,255,255,0.2)',
          color: 'rgba(255,255,255,0.8)',
        },
      },
      styles: {
        mask: { backdropFilter: 'blur(8px)' },
        header: { borderBottom: '1px solid rgba(255,255,255,0.1)' },
        body: { padding: '20px 24px' },
        footer: { borderTop: '1px solid rgba(255,255,255,0.1)' },
      },
      style: {
        background: 'linear-gradient(145deg, #1a2332, #141b26)',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 48px rgba(0,0,0,0.4)',
      },
      onOk: () => setGames(Array(rowCount).fill('')),
    });
  };

  // 数字填充处理
  const handleNumberFill = (input: string) => {
    const validChars = input.trim().replace(/[^123]/g, '');
    if (validChars.length === 0) {
      message.warning('请输入有效的数字（1=庄, 2=闲, 3=和）');
      return;
    }

    const fillCount = Math.min(validChars.length, rowCount);

    setGames(prev => {
      const next = [...prev];
      for (let i = 0; i < fillCount; i++) {
        next[i] = NUM_TO_RESULT[validChars[i]];
      }
      return next;
    });

    message.success(`已填充 ${fillCount} 局数据`);
  };

  // 上传确认 - 增强版：包含重置警告
  const handleUpload = async () => {
    const validGames = games
      .map((result, idx) => ({ game_number: idx + 1, result }))
      .filter(g => g.result !== '');

    if (validGames.length === 0) {
      message.warning('请至少填入1局开奖结果');
      return;
    }

    // 检查当前桌是否有正在进行的游戏
    let hasActiveGame = false;
    let currentStatus = '';
    try {
      const stateRes = await api.getSystemState();
      if (stateRes.data && stateRes.data.status !== '空闲') {
        hasActiveGame = true;
        currentStatus = stateRes.data.status;
      }
    } catch {
      // 静默处理，继续上传流程
    }

    Modal.confirm({
      title: (
        <span style={{ color: '#ff4d4f' }}>
          ⚠️ 警告：上传将重置当前数据
        </span>
      ),
      content: (
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>
          {/* 重置警告区域 */}
          <div style={{
            background: 'rgba(255,77,79,0.1)',
            border: '1px solid rgba(255,77,79,0.3)',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}>
            <p style={{ margin: '0 0 8px 0', color: '#ff4d4f', fontWeight: 600 }}>
              上传新数据将执行以下操作：
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
              <li>清空当前桌所有历史数据</li>
              <li>重置所有工作流状态</li>
              <li>终止正在进行的AI分析</li>
              <li>取消待处理的下注</li>
            </ul>
            {hasActiveGame && (
              <p style={{ margin: '8px 0 0 0', color: '#ff4d4f', fontSize: 12 }}>
                🔴 当前状态：{currentStatus} - 上传将中断当前流程！
              </p>
            )}
          </div>

          {/* 上传信息 */}
          <p>将上传 <strong style={{ color: '#ffd700' }}>{validGames.length}</strong> 局数据到 <strong style={{ color: '#ffd700' }}>{}桌</strong></p>
          <p style={{ marginBottom: 0, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            庄{bankerCount}次 · 闲{playerCount}次 · 和{tieCount}次
          </p>
          <p style={{ marginTop: 8, color: 'rgba(255,165,0,0.8)', fontSize: 12 }}>
            上传后系统将自动计算五路走势图并开始AI分析预测
          </p>
        </div>
      ),
      okText: '确认上传并重置',
      cancelText: '取消',
      okButtonProps: {
        danger: true,
        style: {
          background: 'linear-gradient(135deg,#ff4d4f,#ff7875)',
          borderColor: '#ff4d4f',
          color: '#fff',
          fontWeight: 600,
        },
      },
      cancelButtonProps: {
        style: {
          background: 'rgba(255,255,255,0.1)',
          borderColor: 'rgba(255,255,255,0.2)',
          color: 'rgba(255,255,255,0.8)',
        },
      },
      styles: {
        mask: { backdropFilter: 'blur(8px)' },
        wrapper: {
          background: 'linear-gradient(145deg, #1a2332, #141b26)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 48px rgba(0,0,0,0.4)',
        },
        header: { borderBottom: '1px solid rgba(255,255,255,0.1)' },
        body: { padding: '20px 24px', background: 'transparent' },
        footer: { borderTop: '1px solid rgba(255,255,255,0.1)' },
      },
      onOk: async () => {
        setUploading(true);
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res = await api.uploadGameResults(validGames as any, isNewBoot);
          if (res.data.success) {
            message.success(`上传成功！${res.data.uploaded}局数据已入库，AI分析进行中...`);
            navigate("/dashboard");
          }
        } catch (err: unknown) {
          const errorMsg = (err as Error)?.message === 'Network Error' ? '网络连接失败，请检查后端服务是否正常运行' : (err instanceof Error ? err.message : '上传失败，请重试');
          message.error(errorMsg);
          addIssue({
            level: 'critical',
            title: '数据上传失败',
            detail: `上传数据失败: ${errorMsg}`,
            source: 'system',
          });
          setUploading(false);
        }
      },
    });
  };

  // 管理员登录
  const handleLogin = async (password: string) => {
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
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '登录失败';
      message.error(errorMsg);
      addIssue({
        level: 'warning',
        title: '管理员登录失败',
        detail: `登录失败: ${errorMsg}`,
        source: 'system',
      });
    }
  };

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflow: 'auto',
      background: 'linear-gradient(135deg, #0a0e17 0%, #111927 30%, #0f1623 60%, #0a101c 100%)',
      padding: '16px',
    }}>
      {/* 粒子背景 */}
      <ParticleBackground />

      {/* 背景光晕 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: `radial-gradient(circle at 20% 50%, rgba(255,77,79,0.06) 0%, transparent 50%),
                     radial-gradient(circle at 80% 20%, rgba(24,144,255,0.06) 0%, transparent 50%),
                     radial-gradient(circle at 50% 80%, rgba(255,215,0,0.04) 0%, transparent 50%)`
      }} />

      {/* 管理员按钮 */}
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
        <UploadIcons.Admin />
        管理员
      </button>

      {/* 主卡片 */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        width: '100%',
        maxWidth: 720,
        marginTop: 8,
        padding: '0 8px',
      }}>

        {/* 标题区 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            marginBottom: 12,
            filter: 'drop-shadow(0 0 24px rgba(255,215,0,0.4))',
          }}>
            <UploadIcons.Casino />
          </div>
          <h1 style={{
            fontSize: 'clamp(20px, 5vw, 28px)',
            fontWeight: 800,
            margin: 0,
            background: 'linear-gradient(135deg, #ffd700 0%, #fff 40%, #ffd700 70%, #b8860b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundSize: '200% auto',
            animation: 'shimmer-text 3s linear infinite',
          }}>
            智能AI
          </h1>
          <p style={{
            marginTop: 6,
            color: 'rgba(255,255,255,0.5)',
            fontSize: 'clamp(11px, 2.5vw, 13px)',
            letterSpacing: '1px'
          }}>
            百家乐分析预测系统 · 手动上传 · AI三模型分析
          </p>
        </div>

        {/* 控制栏 */}
        <ControlBar
          rowCount={rowCount}
          onRowCountChange={handleRowCountChange}
          onQuickFill={handleQuickFill}
          onNumberFillClick={() => setNumberFillVisible(true)}
          onClear={handleClear}
        />

        {/* 统计条 */}
        <StatsBar
          filled={filled}
          rowCount={rowCount}
          bankerCount={bankerCount}
          playerCount={playerCount}
          tieCount={tieCount}
        />

        {/* 珠盘路面板 */}
        <BeadRoadGrid
          games={games}
          rowCount={rowCount}
          onCellClick={handleCellClick}
        />

        {/* 操作按钮区域 */}
        <UploadArea
          filled={filled}
          uploading={uploading}
          onUpload={handleUpload}
        />

        {/* 验证面板 */}
        <ValidationPanel />
      </div>

      {/* 登录弹窗 */}
      <LoginModal
        visible={loginVisible}
        onClose={() => setLoginVisible(false)}
        onLogin={handleLogin}
      />

      {/* 数字填充弹窗 */}
      <NumberFillModal
        visible={numberFillVisible}
        rowCount={rowCount}
        onClose={() => setNumberFillVisible(false)}
        onFill={handleNumberFill}
      />
    </div>
  );
};

export default UploadPage;
