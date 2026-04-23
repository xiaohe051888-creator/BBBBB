# 百家乐智能分析与预测系统 (Mobile App v3.0)

> 一套基于手动数据录入、原生高性能五路走势图分析、三 AI 大模型协作预测的智能辅助系统。
> **目前已全面重构为 React Native (Expo) 移动端应用。**

---

## 目录

- [项目简介](#项目简介)
- [系统架构](#系统架构)
- [功能特性](#功能特性)
- [快速启动](#快速启动)
- [项目结构](#项目结构)

---

## 项目简介

BBBBB 是一套**百家乐走势分析与预测系统**（v3.0.0 移动端模式），专为手机单手操作和高性能渲染而设计。

核心工作流：
```text
手机快捷录入本靴数据 → 生成原生 Skia 五路走势图 → 三模型 AI 深度预测 
→ 用户参考下注 → 底部抽屉录入开奖结果 → 自动结算与复盘记录 → 触发下一局预测
```

**亮点：**
- **原生应用体验**：基于 React Native 打造，拥有极致丝滑的 Bottom Sheet 抽屉交互与底层手势支持。
- **电竞级走势图**：废弃了传统的 DOM 节点堆叠，采用 `@shopify/react-native-skia` 2D 绘图引擎重写了珠盘路与大路，支持百局走势流畅滑动。
- **移动端防挂机断线**：集成 `AppState` 监听，App 从后台唤醒后自动重连 WebSocket 并静默刷新全量数据，防止锁屏漏单。
- **高性能长列表**：历史注单与错题本使用 `@shopify/flash-list` 渲染，支持千条数据 60FPS 滚动不卡顿。
- **单靴纯净隔离**：彻底移除了旧版多桌台 (`tableId`) 概念，系统每次仅专注分析当前一靴，换靴时彻底物理清空旧有数据与错题本残留，避免“幽灵血迹”污染 AI。

---

## 系统架构

系统分为两个主要部分：

1. **Backend (后端)**: FastAPI + SQLite + WebSockets
   - 提供 RESTful API 用于数据上传、开奖结果提报、错题本查询。
   - 包含智能 AI 分析代理（DeepSeek, OpenAI, Claude）的三模型联合预测服务。
   - 通过 WebSocket 实时推送系统状态、走势更新、结算结果与系统日志。

2. **Mobile (移动端)**: React Native + Expo
   - 使用 `@react-navigation/bottom-tabs` 进行页面路由。
   - 使用 `@tanstack/react-query` 管理 API 数据缓存与状态同步。
   - 使用 `@gorhom/bottom-sheet` 实现流畅的开奖、上传交互。

---

## 功能特性

* **单靴精准分析**：彻底抛弃复杂的桌台选择，一键“换靴”，数据独立，AI 分析更纯粹。
* **快捷数据上传**：通过底部抽屉输入纯数字序列（1=庄, 2=闲, 3=和），即可极速初始化一靴数据。
* **AI 三模型预测机制**：
  * 在开奖后或数据上传后自动触发。
  * 若模型遇到网络波动或限流，系统支持最高 5 次的指数退避重试（1s -> 16s）。
  * 若分析彻底失败，系统自动回退至“等待开奖”状态，并显示【开奖】按钮，允许用户手动继续，绝生死锁。
* **深度学习与错题本**：
  * 当用户点击“换靴”时，触发后台长达数十秒的 AI 深度学习。
  * 生成详细的错误原因分析并记录入库，App 内置独立的《错题本》Tab 供用户随时复盘。

---

## 快速启动

### 1. 启动后端 (Backend)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 启动 FastAPI 服务 (默认运行在 http://localhost:8000)
python3 -m uvicorn app.api.main:app --host 0.0.0.0 --port 8000
```

### 2. 启动移动端 App (Mobile)

请确保你的开发机已安装 Node.js (v18+)

```bash
cd mobile
npm install

# 启动 Expo 开发服务器
npm run start
```
*在终端中按 `a` 可在 Android 模拟器中打开，按 `i` 可在 iOS 模拟器中打开，或者使用手机上的 Expo Go 扫码预览。*

---

## 项目结构

```text
/workspace
├── backend/                # FastAPI 后端目录
│   ├── app/                # 核心应用逻辑 (API, Services, Models)
│   ├── requirements.txt    # 后端依赖
│   └── tests/              # 自动化测试用例
└── mobile/                 # React Native (Expo) 移动端目录
    ├── src/
    │   ├── api/            # API 请求与拦截器
    │   ├── components/     # UI 组件 (WorkflowStatusBar, FiveRoadsChart, BottomSheets)
    │   ├── hooks/          # React Query 与 WebSocket 逻辑
    │   ├── navigation/     # AppNavigator 底部导航路由
    │   └── screens/        # 页面 (Dashboard, Records, Mistakes)
    ├── App.js              # 移动端入口文件
    └── package.json        # 前端依赖
```
