/**
 * 前端入口 - 百家乐分析预测系统
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 全局样式重置
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
