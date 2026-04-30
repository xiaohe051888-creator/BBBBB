# 继续加固：后台任务统一规范 + 前端路由级拆包 设计稿

日期：2026-04-30

## 目标

1. 后端不再散落使用裸 `asyncio.create_task` 创建“fire-and-forget”任务，统一走封装，避免漏强引用/难排障/不一致落库。
2. 业务级后台任务统一走 `start_background_task(...)`，保证：任务落库、可追溯、日志自动注入 `task_id`。
3. 前端 App 路由页面改为 `React.lazy` 动态加载，降低首屏 bundle 压力，缓解构建的 chunk 过大告警。

## 后端方案（软约束）

### 1) 新增 spawn_task

新增 `app/core/async_utils.py`：
- `spawn_task(coro)`：用于“fire-and-forget”场景
- 内部持有强引用集合，task 完成后自动释放
- 返回 `asyncio.Task` 供必要时继续链式处理

### 2) 业务后台任务统一 start_background_task

新增/使用 `app/services/game/session.py::start_background_task(task_type, coro, boot_number?, dedupe_key?)`：
- 内部调用 `registry.create(...)` 创建/落库
- 自动把返回的 task 加入强引用集合，防止 GC

### 3) 改造现存裸 create_task

- 广播清理等“非业务任务”使用 `spawn_task`
- 需要并行执行但会被 await 的场景，优先使用 `asyncio.gather(...)` 直接聚合 coroutine（避免显式 create_task）

## 前端方案（路由级拆包）

### 1) React.lazy 动态 import 页面

在 `App.tsx` 中把各页面改成：
- `const LogsPage = React.lazy(() => import('./pages/LogsPage'))` 等

### 2) Suspense 统一加载态

在路由渲染区域外层包一层 `Suspense`：
- fallback 使用 `antd` 的 `Spin`（不引入额外库）

## 验收

1. 后端关键“fire-and-forget”不再直接使用裸 `asyncio.create_task`（保留极少数必要内部实现亦可接受，但统一迁移为 `spawn_task`/`gather` 为主）。
2. 业务后台任务由 `start_background_task` 创建，可在任务列表看到记录，日志 `task_id` 注入链路不丢失。
3. 前端 build/lint 通过，路由页面改为按需加载。

