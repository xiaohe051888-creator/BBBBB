/**
 * App 主入口 - 百家乐分析预测系统
 * 设计风格：奢华赌场风格 + 现代极简主义
 *
 * 布局架构：
 * - 启动页：无侧边栏，全屏沉浸式
 * - 功能页：桌面端可折叠侧边栏 + 移动端底部Tab栏 + 顶部状态栏 + 内容区
 */
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import zhCN from 'antd/locale/zh_CN';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';
import RoadMapPage from './pages/RoadMapPage';
import BetRecordsPage from './pages/BetRecordsPage';
import LogsPage from './pages/LogsPage';
import MistakeBookPage from './pages/MistakeBookPage';
import AdminPage from './pages/AdminPage';
import { getToken } from './services/api';
import { queryClient } from './lib/queryClient';

// 侧边栏布局组件
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // 启动页和管理员登录页不显示侧边栏
  if (location.pathname === '/' || location.pathname === '/admin') {
    return <>{children}</>;
  }

  const navItems = [
    { key: 'home', icon: '🏠', label: '首页总览', path: `/dashboard/:tableId`, desc: '智能分析+五路图' },
    { key: 'roadmap', icon: '📊', label: '五路走势图', path: `/dashboard/:tableId/roadmap`, desc: '大路·珠盘·下三路' },
    { key: 'bets', icon: '💰', label: '下注记录', path: `/dashboard/:tableId/bets`, desc: '仿真下注流水' },
    { key: 'logs', icon: '📋', label: '实盘日志', path: `/dashboard/:tableId/logs`, desc: '实时运行日志' },
    { key: 'mistakes', icon: '📓', label: '错题本', path: `/dashboard/:tableId/mistakes`, desc: '本靴复盘修正' },
  ];

  const getActiveKey = () => {
    const path = location.pathname;
    if (path.includes('/roadmap')) return 'roadmap';
    if (path.includes('/bets')) return 'bets';
    if (path.includes('/logs')) return 'logs';
    if (path.includes('/mistakes')) return 'mistakes';
    return 'home';
  };

  const match = location.pathname.match(/\/dashboard\/([^/]+)/);
  const tableId = match ? match[1] : '';

  const handleNav = (key: string) => {
    switch (key) {
      case 'home': navigate(`/dashboard/${tableId}`); break;
      case 'roadmap': navigate(`/dashboard/${tableId}/roadmap`); break;
      case 'bets': navigate(`/dashboard/${tableId}/bets`); break;
      case 'logs': navigate(`/dashboard/${tableId}/logs`); break;
      case 'mistakes': navigate(`/dashboard/${tableId}/mistakes`); break;
    }
  };

  return (
    <div className="page-transition" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ====== 桌面端侧边栏 ====== */}
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Logo区域 */}
        <div className="sidebar-logo">
          {!collapsed ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎰</div>
              <h2>BBBBB</h2>
              <p style={{
                margin: '4px 0 0',
                fontSize: 11,
                color: 'var(--text-muted)',
                letterSpacing: 1.5,
              }}>
                百家乐分析预测系统
              </p>
            </>
          ) : (
            <div style={{ fontSize: 28 }}>🎰</div>
          )}
        </div>

        {/* 导航项 */}
        <nav className="sidebar-nav">
          {navItems.map(item => {
            const isActive = getActiveKey() === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNav(item.key)}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                {/* 激活指示条 */}
                {isActive && !collapsed && (
                  <div className="nav-active-indicator" />
                )}

                <span className="nav-item nav-icon">{item.icon}</span>
                {!collapsed && <span className="nav-text">{item.label}</span>}

                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <div className="sidebar-tooltip">
                    {item.label}
                    <div className="sidebar-tooltip-desc">{item.desc}</div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* 收起按钮 */}
        <div className="sidebar-footer">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setCollapsed(!collapsed)}
          >
            <span style={{ fontSize: 15 }}>{collapsed ? '→' : '←'}</span>
            {!collapsed && <span>收起菜单</span>}
          </button>
        </div>
      </aside>

      {/* ====== 主内容区域 ====== */}
      <div style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
        {children}
      </div>

      {/* ====== 移动端底部Tab栏（仅≤768px显示）====== */}
      <nav className="mobile-bottom-tab-bar">
        {navItems.map(item => {
          const isActive = getActiveKey() === item.key;
          return (
            <button
              key={item.key}
              className={`mobile-tab-item ${isActive ? 'active' : ''}`}
              onClick={() => handleNav(item.key)}
            >
              <span className="mobile-tab-icon">{item.icon}</span>
              <span>{item.label.replace('五路走势图', '走势').replace('首页总览', '总览')}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#ffd700',
            colorSuccess: '#52c41a',
            colorWarning: '#faad14',
            colorError: '#ff4d4f',
            colorInfo: '#1890ff',
            borderRadius: 10,
            fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif',
            colorBgContainer: 'rgba(22,29,42,0.85)',
            colorBgElevated: 'rgba(17,23,35,0.92)',
            colorBgLayout: '#0a0e17',
            colorBorder: 'rgba(48,54,68,0.4)',
            colorText: '#e6edf3',
            colorTextSecondary: '#8b949e',
            controlHeight: 38,
          },
          components: {
            Card: {
              colorBgContainer: 'rgba(22,29,42,0.85)',
              boxShadowTertiary: '0 4px 24px rgba(0,0,0,0.25)',
            },
            Table: {
              colorBgContainer: 'rgba(22,29,42,0.7)',
              headerBg: 'rgba(15,21,33,0.7)',
              rowHoverBg: 'rgba(255,255,255,0.03)',
              borderColor: 'rgba(48,54,68,0.25)',
            },
            Tabs: {
              inkBarColor: '#ffd700',
              itemSelectedColor: '#ffd700',
              itemColor: 'rgba(255,255,255,0.5)',
            },
            Modal: {
              contentBg: 'rgba(15,21,33,0.97)',
              headerBg: 'rgba(15,21,33,0.99)',
            },
            Select: {
              optionSelectedBg: 'rgba(255,215,0,0.12)',
            },
            Button: {
              primaryShadow: '0 4px 20px rgba(255, 215, 0, 0.3)',
            },
          },
        }}
      >
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<UploadPage />} />
              <Route path="/dashboard/:tableId" element={<DashboardPage />} />
              <Route path="/dashboard/:tableId/roadmap" element={<RoadMapPage />} />
              <Route path="/dashboard/:tableId/bets" element={<BetRecordsPage />} />
              <Route path="/dashboard/:tableId/logs" element={<LogsPage />} />
              <Route path="/dashboard/:tableId/mistakes" element={<MistakeBookPage />} />
              <Route path="/admin" element={getToken() ? <AdminPage /> : <Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
