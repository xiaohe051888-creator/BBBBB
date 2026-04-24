/**
 * App 主入口 - 智能AI
 * 设计风格：奢华赌场风格 + 现代极简主义
 *
 * 布局架构：
 * - 启动页：无侧边栏，全屏沉浸式
 * - 功能页：桌面端可折叠侧边栏 + 移动端底部Tab栏 + 顶部状态栏 + 内容区
 */
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ConfigProvider, theme, App as AntApp } from 'antd';
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
import { PageErrorBoundary } from './components/error';

// 精致SVG图标组件
const NavIcons = {
  Home: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>
  ),
  Chart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
    </svg>
  ),
  Coin: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/>
    </svg>
  ),
  File: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
    </svg>
  ),
  Book: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
    </svg>
  ),
  Logo: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  ),
};

// 侧边栏布局组件
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // 检测屏幕尺寸变化
  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // 移动端自动收起侧边栏，桌面端自动展开
      setCollapsed(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 启动页和管理员登录页不显示侧边栏
  if (location.pathname === '/' || location.pathname === '/admin') {
    return <>{children}</>;
  }

  const navItems = [
    { key: 'home', Icon: NavIcons.Home, label: '首页总览', path: `/dashboard`, desc: '智能分析+五路图' },
    { key: 'roadmap', Icon: NavIcons.Chart, label: '五路走势图', path: `/dashboard/roadmap`, desc: '大路·珠盘·下三路' },
    { key: 'bets', Icon: NavIcons.Coin, label: '下注记录', path: `/dashboard/bets`, desc: '仿真下注流水' },
    { key: 'logs', Icon: NavIcons.File, label: '实盘日志', path: `/dashboard/logs`, desc: '实时运行日志' },
    { key: 'mistakes', Icon: NavIcons.Book, label: '错题本', path: `/dashboard/mistakes`, desc: '本靴复盘修正' },
  ];

  const getActiveKey = () => {
    const path = location.pathname;
    if (path.includes('/roadmap')) return 'roadmap';
    if (path.includes('/bets')) return 'bets';
    if (path.includes('/logs')) return 'logs';
    if (path.includes('/mistakes')) return 'mistakes';
    return 'home';
  };

  const handleNav = (key: string) => {
    switch (key) {
      case 'home': navigate(`/dashboard`); break;
      case 'roadmap': navigate(`/dashboard/roadmap`); break;
      case 'bets': navigate(`/dashboard/bets`); break;
      case 'logs': navigate(`/dashboard/logs`); break;
      case 'mistakes': navigate(`/dashboard/mistakes`); break;
    }
  };

  return (
    <div className="page-transition" style={{ minHeight: '100vh' }}>
      {/* ====== 桌面端侧边栏 ====== */}
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Logo区域 */}
        <div className="sidebar-logo">
          {!collapsed ? (
            <>
              <div style={{ marginBottom: 8, color: '#ffd700' }}><NavIcons.Logo /></div>
              <h2>智能AI</h2>
            </>
          ) : (
            <div style={{ color: '#ffd700' }}><NavIcons.Logo /></div>
          )}
        </div>

        {/* 收起/展开按钮 - 移到Logo下方，方便点击 */}
        <div className="sidebar-toggle-wrapper">
          <button
            className="sidebar-toggle-btn-compact"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? '展开菜单' : '收起菜单'}
          >
            <span style={{ fontSize: 14 }}>{collapsed ? '→' : '←'}</span>
            {!collapsed && <span style={{ fontSize: 11 }}>收起</span>}
          </button>
        </div>

        {/* 导航项 */}
        <nav className="sidebar-nav">
          {navItems.map(item => {
            const isActive = getActiveKey() === item.key;
            const IconComponent = item.Icon;
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

                <span className="nav-item nav-icon"><IconComponent /></span>
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
      </aside>

      {/* ====== 主内容区域 ====== */}
      <div
        style={{
          minWidth: 0,
          overflowX: 'auto',  /* 允许水平滚动（如有过宽的表格） */
          marginLeft: isMobile ? 0 : (collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)'),
          transition: 'margin-left var(--transition-slow)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>

      {/* ====== 移动端底部Tab栏（仅≤768px显示）====== */}
      <nav className="mobile-bottom-tab-bar">
        {navItems.map(item => {
          const isActive = getActiveKey() === item.key;
          const IconComponent = item.Icon;
          return (
            <button
              key={item.key}
              className={`mobile-tab-item ${isActive ? 'active' : ''}`}
              onClick={() => handleNav(item.key)}
            >
              <span className="mobile-tab-icon"><IconComponent /></span>
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
    <PageErrorBoundary>
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
          <AntApp>
            <BrowserRouter>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<UploadPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/dashboard/roadmap" element={<RoadMapPage />} />
                  <Route path="/dashboard/bets" element={<BetRecordsPage />} />
                  <Route path="/dashboard/logs" element={<LogsPage />} />
                  <Route path="/dashboard/mistakes" element={<MistakeBookPage />} />
                  <Route path="/admin" element={getToken() ? <AdminPage /> : <Navigate to="/" replace />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </AppLayout>
            </BrowserRouter>
          </AntApp>
        </ConfigProvider>
      </QueryClientProvider>
    </PageErrorBoundary>
  );
};

export default App;
