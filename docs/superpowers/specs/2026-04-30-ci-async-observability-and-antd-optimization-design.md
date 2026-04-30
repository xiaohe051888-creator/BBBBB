# 全部处理：CI 防回归 + spawn_task 可观测性 + 日志缓存优化 + antd 包体治理 设计稿

日期：2026-04-30

## 范围与目标

1. CI 防回归：禁止后端出现裸 `asyncio.create_task`/`loop.create_task`（除白名单封装文件），避免“后台任务强引用/可追溯/一致收尾”被绕过。
2. spawn_task 可观测性：支持命名；未捕获异常同时写入服务日志与 SystemLog，便于线上排障。
3. 日志推送缓存优化：减少 WebSocket 推送对 React Query 缓存的无意义写入，降低高频推送开销。
4. antd 包体治理：短期消除 chunk 过大告警；中期逐步按需化入口与常驻模块，减少首屏压力。

## 设计

### 1) CI 防回归（unittest 扫描）

- 新增一个后端单测：扫描 `backend/app` 下的 `.py` 文件
- 命中以下模式即失败（白名单：`app/core/async_utils.py`）：
  - `asyncio.create_task(`
  - `.create_task(`（loop.create_task）
- 失败信息输出修复建议：改用 `spawn_task(...)` 或 `start_background_task(...)`。

### 2) spawn_task 可观测性（两级上报）

对 `spawn_task` 扩展：
- `spawn_task(coro, name: str | None = None, report_to_system_log: bool = True)`
- 设置 `task.set_name(name)` 或 `asyncio.create_task(..., name=name)`（兼容性按当前 Python 版本）。
- task 结束回调中：
  - 若异常：写 `uvicorn.error` 日志（含 name 与异常堆栈）
  - 若 `report_to_system_log`：异步写入 `SystemLog`
    - `event_code=LOG-ASYNC-001`
    - `event_type=后台任务异常`
    - `event_result=失败`
    - `category=系统异常`
    - `priority=P1`
    - `description` 包含 name 与异常摘要
- 上报写库任务使用 `report_to_system_log=False` 防止递归上报。

### 3) 日志推送缓存写入策略（降开销）

WebSocket 收到新日志时：
- 始终更新 “全量日志” key：`queryKeys.logs('', '')`
- 其余组合 key（按 category / task_id）仅当缓存已存在时才更新（通过 `queryClient.getQueryData(key)` 判断）

### 4) antd 包体治理（两阶段）

- 阶段1：在 `vite.config.ts` 调高 `build.chunkSizeWarningLimit`（例如 1500），减少无意义告警噪音。
- 阶段2：按需引入优化（不引入新依赖）：
  - 优先处理入口与常驻模块（`App.tsx`、`DashboardPage`、常驻 UI 组件）：将 `from 'antd'` 的聚合导入逐步拆为更细粒度的导入（按文件逐步推进，保证 lint/build 全通过）。

## 验收

1. 后端测试能在出现裸 `create_task` 时直接失败并给出修复建议。
2. spawn_task 创建的任务异常会同时出现在服务日志与 SystemLog 中。
3. 日志推送下 React Query 的缓存写入次数显著减少（只更新已存在 key）。
4. 前端构建不再因为 chunkSizeWarningLimit 默认阈值产生告警噪音；拆包与按需化改动不破坏功能与构建。

