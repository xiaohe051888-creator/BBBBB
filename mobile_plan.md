# 百家乐 Web 应用至 React Native (Expo) 移动端重构计划

## 1. 项目概述与技术栈选型

本次重构旨在将现有的基于 React + Vite 的百家乐 Web 应用迁移至 React Native 移动端环境。考虑到开发效率与跨平台兼容性，我们将采用 **Expo** 框架进行开发。

### 核心技术栈
- **框架**: React Native (Expo)
- **路由**: React Navigation (替代现有的 React Router)
- **状态管理与数据缓存**: React Query (`@tanstack/react-query`) (完美复用现有 Web 端逻辑)
- **网络请求**: Axios + 原生 WebSocket API
- **图形渲染 (五路图)**: `@shopify/react-native-skia` (替代 HTML5 Canvas，提供原生级别的高性能 2D 渲染)
- **UI 组件库**: 原生 StyleSheet + `@gorhom/bottom-sheet` (用于开奖等底部弹窗) + 自定义 UI 组件

---

## 2. 核心功能实现方案

### 2.1 仪表盘页面 (Dashboard) 重构

移动端屏幕较小，无法直接套用 Web 端的左右分栏布局。我们需要将其改造为**上下滚动流式布局**或**模块化折叠布局**。

- **顶部状态区 (Header)**: 
  - 精简版的 `DashboardHeader`，显示当前靴号、健康分 (`healthScore`)、系统诊断状态等。
  - `Progress` 进度条组件用于显示本靴进度、命中/失误率。
- **核心交互区 (Workflow & Analysis)**:
  - 提取 `WorkflowStatusBar` 和 `AnalysisPanel`，作为页面的视觉中心。
  - 当 AI 给出预测 (`analysis?.prediction`) 且当前处于 `等待开奖` 状态时，高亮显示预测结果。
- **开奖弹窗 (RevealModal)**:
  - 使用 `@gorhom/bottom-sheet` 替换原有的居中 Modal，提供更符合移动端交互习惯的底部抽屉体验。
- **数据表格 (Tables)**:
  - `GameTable`, `BetTable`, `LogTable` 需使用 React Native 的 `FlatList` 或 `SectionList` 重新实现，以保证长列表的滚动性能。
  - 建议在仪表盘只展示最近 5-10 条记录，提供“查看全部”按钮跳转至独立页面。

### 2.2 五路走势图 (Five Roads Chart) 移动端适配

Web 端目前使用了多个 Canvas 组件 (`BeadRoadCanvas`, `BigRoadCanvas`, `DerivedRoadCanvas`)。移动端由于没有原生 DOM Canvas，需彻底重构。

- **技术方案选型**: 
  强烈建议使用 `@shopify/react-native-skia`。它的 API 与 HTML5 Canvas 高度相似（如 `drawRect`, `drawCircle` 等），这使得现有渲染逻辑的迁移成本降到最低，且性能远超普通的 `react-native-svg` 或 `View` 堆叠。
- **布局适配策略**:
  - **格子大小调整**: 移动端的基础格子大小 (`BASE_CELL_SIZE`) 建议缩小至 14-16px，以在单屏内容纳更多路单。
  - **大路 (Big Road)**: 占满屏幕宽度，外部包裹 `ScrollView` 且设置 `horizontal={true}`，允许用户左右滑动查看历史走势。
  - **珠盘路 (Bead Road)**: 固定列数（如 6 列或 10 列），在左下角固定展示。
  - **大眼仔、小路、甲由路**: 垂直排列或网格排列在大路下方，同样支持横向滑动 (`ScrollView`)。
  - **自动滚动**: 保留 Web 端新数据到达时自动 `scrollToEnd` 的逻辑。

### 2.3 WebSocket 实时通讯逻辑迁移

Web 端的 `useWebSocket.ts` 已经实现了重连和心跳机制，React Native 同样支持标准 WebSocket API，因此业务逻辑可高度复用，但需要针对移动端特性进行增强。

- **Hooks 复用**: 
  可以直接迁移现有的乐观更新逻辑（如 `useAddBetOptimistically`, `useAddGameOptimistically` 等），保证收到 `bet_placed` 或 `game_revealed` 等 WebSocket 消息时 UI 能瞬间响应。
- **移动端 AppState 监听 (关键差异)**:
  - 移动端 App 经常会被切入后台（如用户回微信消息），此时操作系统可能会挂起应用，导致 WebSocket 连接断开。
  - **解决方案**: 引入 React Native 的 `AppState` API。
    ```typescript
    useEffect(() => {
      const subscription = AppState.addEventListener('change', nextAppState => {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
          // App 回到前台，检查 WS 状态并强制重连
          reconnect();
          // 同时触发全量数据刷新，防止后台期间遗漏 WebSocket 消息
          queryClient.invalidateQueries({ queryKey: queryKeys.systemState() });
          queryClient.invalidateQueries({ queryKey: queryKeys.roads() });
          // ... 刷新其他数据
        }
        appState.current = nextAppState;
      });
      return () => subscription.remove();
    }, []);
    ```

---

## 3. 目录架构规划

```text
/mobile-app (Expo 项目根目录)
├── src/
│   ├── api/            # API 请求封装 (复用 Web 端 services/api.ts)
│   ├── components/     # UI 组件
│   │   ├── roads/      # 基于 Skia 重写的五路图组件
│   │   ├── dashboard/  # 仪表盘卡片组件
│   │   └── ui/         # 通用基础组件 (按钮、弹窗等)
│   ├── hooks/          # 自定义 Hooks (复用 Web 端的业务逻辑与 WebSocket)
│   ├── navigation/     # React Navigation 路由配置
│   ├── screens/        # 页面视图 (DashboardScreen, LoginScreen 等)
│   ├── store/          # 状态管理 (React Query 的 queryClient 配置)
│   ├── types/          # TypeScript 类型定义
│   └── utils/          # 工具函数 (常量、格式化等)
├── app.json            # Expo 配置文件
├── babel.config.js     # Babel 配置
└── package.json        # 依赖管理
```

---

## 4. 实施步骤与排期 (预估 1-2 周)

| 阶段 | 核心任务 | 重点与难点 |
|---|---|---|
| **第一阶段** (基础设施) | 初始化 Expo 项目，配置路由与 React Query | 迁移 `api.ts` 与现有 HTTP 请求拦截器，确保 Token 机制正常运作 |
| **第二阶段** (数据流) | 迁移 `useWebSocket` 与所有的查询 Hooks | 处理 `AppState` 监听，解决前后台切换时的断线重连与数据同步问题 |
| **第三阶段** (五路图引擎) | 引入 React Native Skia，重写路牌渲染引擎 | Skia API 与 Canvas API 的映射转换；实现多路图的流式布局与横向滚动 |
| **第四阶段** (UI 组装) | 开发 Dashboard 屏幕，整合各个业务组件 | 移动端屏幕空间受限，需精简展示信息，优化 BottomSheet 抽屉交互体验 |
| **第五阶段** (性能与测试) | 真机测试，优化长列表与动画性能 | `FlatList` 性能调优，处理 Skia 渲染在大数据量下的帧率问题 |
