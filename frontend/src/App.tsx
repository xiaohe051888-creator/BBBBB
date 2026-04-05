/**
 * App 主入口 - 百家乐分析预测系统
 * 布局：可折叠侧边栏 + 顶部状态栏 + 内容区
 */
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import StartPage from './pages/StartPage';
import DashboardPage from './pages/DashboardPage';
import RoadMapPage from './pages/RoadMapPage';
import BetRecordsPage from './pages/BetRecordsPage';
import LogsPage from './pages/LogsPage';
import AdminPage from './pages/AdminPage';

// 侧边栏布局组件
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  
  // 启动页不显示侧边栏
  if (location.pathname === '/' || location.pathname === '/admin') {
    return <>{children}</>;
  }

  const navItems = [
    { key: 'home', icon: '🏠', label: '首页', path: `/dashboard/:tableId` },
    { key: 'roadmap', icon: '📊', label: '走势图', path: `/dashboard/:tableId/roadmap` },
    { key: 'bets', icon: '💰', label: '下注记录', path: `/dashboard/:tableId/bets` },
    { key: 'logs', icon: '📋', label: '实盘日志', path: `/dashboard/:tableId/logs` },
  ];

  // 获取当前激活的 nav key
  const getActiveKey = () => {
    const path = location.pathname;
    if (path.includes('/roadmap')) return 'roadmap';
    if (path.includes('/bets')) return 'bets';
    if (path.includes('/logs')) return 'logs';
    return 'home';
  };

  // 获取 tableId
  const match = location.pathname.match(/\/dashboard\/([^/]+)/);
  const tableId = match ? match[1] : '';

  const handleNav = (key: string) => {
    let basePath = '';
    switch (key) {
      case 'home': basePath = `/dashboard/${tableId}`; break;
      case 'roadmap': basePath = `/dashboard/${tableId}/roadmap`; break;
      case 'bets': basePath = `/dashboard/${tableId}/bets`; break;
      case 'logs': basePath = `/dashboard/${tableId}/logs`; break;
    }
    window.location.href = basePath; // 简单跳转
  };

  return (
    <div className="app-layout">
      {/* 侧边栏 */}
      <div className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-logo">
          <h2>{!collapsed && '🎰 BBBBB'}</h2>
          {collapsed && '🎰'}
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.key}
              className={`nav-item ${getActiveKey() === item.key ? 'active' : ''}`}
              onClick={() => handleNav(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setCollapsed(!collapsed)}
          >
            <span>{collapsed ? '→' : '←'}</span>
            {!collapsed && <span>收起</span>}
          </button>
        </div>
      </div>

      {/* 主内容 */}
      <div className="main-content">{children}</div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#58a6ff',
          borderRadius: 8,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
          colorBgContainer: '#161b22',
          colorBgElevated: '#1c2128',
          colorBorder: '#21262d',
          colorText: '#e6edf3',
          colorTextSecondary: '#8b949e',
        },
        components: {
          Card: { colorBgContainer: '#161b22' },
          Table: { 
            colorBgContainer: '#161b22',
            headerBg: '#1c2128',
            rowHoverBg: '#1c2128',
          },
        }
      }}
    >
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<StartPage />} />
            <Route path="/dashboard/:tableId" element={<DashboardPage />} />
            <Route path="/dashboard/:tableId/roadmap" element={<RoadMapPage />} />
            <Route path="/dashboard/:tableId/bets" element={<BetRecordsPage />} />
            <Route path="/dashboard/:tableId/logs" element={<LogsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </ConfigProvider>
  );
};

export default App;
