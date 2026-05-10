/**
 * 前端入口 - 百家乐分析预测系统
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './pwa/registerServiceWorker';

// 全局样式重置
import './styles/global.css';

void registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
