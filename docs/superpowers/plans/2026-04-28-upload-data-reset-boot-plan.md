# 上传数据入口统一化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页顶部提供一个“上传数据”入口，进入独立上传页，支持 1/2/3 快速录入 + 6×12 珠盘格子录入，并在确认上传时选择“重置本靴/结束本靴（可选深度学习）+ 余额处理”。

**Architecture:** 前端新增 UploadDataPage（/upload）承载数据录入与确认弹窗；后端扩展 `/api/games/upload` 请求体参数以明确区分覆盖本靴与开启新靴，并在新靴场景可选触发 end_boot 深度学习流程。

**Tech Stack:** React + TypeScript + Ant Design + React Router + TanStack Query；FastAPI + SQLAlchemy Async + SQLite。

---

## Files to Touch

**Frontend**
- Modify: [DashboardHeader.tsx](file:///workspace/frontend/src/components/dashboard/DashboardHeader.tsx)（顶部按钮替换为“上传数据”）
- Modify: `frontend/src/App.tsx`（新增 /upload 路由）
- Create: `frontend/src/pages/UploadDataPage.tsx`（独立上传页）
- Create: `frontend/src/components/upload/BeadGridInput.tsx`（6×12 珠盘格子输入组件）
- Create: `frontend/src/components/upload/QuickKeyInput.tsx`（1/2/3 键盘输入组件）
- Create: `frontend/src/components/upload/UploadConfirmModal.tsx`（确认上传弹窗：动作/余额/深度学习选项 + 勾选确认）
- Modify: [api.ts](file:///workspace/frontend/src/services/api.ts)（扩展 uploadGameResults 参数）

**Backend**
- Modify: `backend/app/services/game/upload.py`（修复“续传校验 vs 覆盖清场”冲突；新增 mode/balance_mode/run_deep_learning 语义）
- Modify: `backend/app/api/routes/game.py`（upload 路由请求体解析扩展；参数透传到 service）
- Modify: `backend/app/services/game/boot.py`（提供可复用的 end_boot 调用入口/校验复用；如已有则不改）

**Tests**
- Create: `backend/tests/test_upload_modes.py`（覆盖本靴/新靴（含深度学习开关））

---

## Task 1: 前端路由与顶部入口

**Files:**
- Modify: [DashboardHeader.tsx](file:///workspace/frontend/src/components/dashboard/DashboardHeader.tsx)
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: 新增 /upload 路由**

在 `frontend/src/App.tsx` 增加页面路由：

```tsx
import UploadDataPage from './pages/UploadDataPage';

// routes
<Route path="/upload" element={<UploadDataPage />} />
```

- [ ] **Step 2: 顶部按钮替换**

在 `DashboardHeader` 顶部按钮区域，将“结束本靴”入口替换为：
- 按钮文案：上传数据
- onClick：`navigate('/upload')`

（保留管理员按钮不动）

- [ ] **Step 3: 手工验证**

运行前端开发服务器后：
- 进入首页，顶部存在“上传数据”
- 点击进入 `/upload`

---

## Task 2: UploadDataPage 页面骨架（列表数据源 + 72 局限制）

**Files:**
- Create: `frontend/src/pages/UploadDataPage.tsx`

- [ ] **Step 1: 定义本地数据结构**

`results: Array<'庄'|'闲'|'和'>`，对应第 1..N 局（数组下标 0..N-1）。

- [ ] **Step 2: 页面展示**

页面最少包含：
- 标题：上传数据
- 左侧：珠盘格子输入占位
- 右侧：局序列列表（第 i 局：结果 + 删除）
- 底部：按钮“确认上传”

- [ ] **Step 3: 校验**

在点击“确认上传”前做校验：
- N 在 1..72
- 不允许空洞（数组必须连续）

---

## Task 3: QuickKeyInput（1/2/3 快速输入，双向同步到 results）

**Files:**
- Create: `frontend/src/components/upload/QuickKeyInput.tsx`
- Modify: `frontend/src/pages/UploadDataPage.tsx`

- [ ] **Step 1: 组件 API 设计**

```ts
type Props = {
  results: Array<'庄'|'闲'|'和'>;
  onChange: (next: Array<'庄'|'闲'|'和'>) => void;
  max: number; // 72
};
```

- [ ] **Step 2: 键盘规则**

监听 keydown：
- '1' => push '庄'
- '2' => push '闲'
- '3' => push '和'
- 'Backspace' => pop

必须阻止超过 max 的输入。

- [ ] **Step 3: 页面接入**

在 UploadDataPage 中渲染 QuickKeyInput，并确保 results 改动后列表立即更新。

---

## Task 4: BeadGridInput（6×12 珠盘格子，点击循环，回写到 results）

**Files:**
- Create: `frontend/src/components/upload/BeadGridInput.tsx`
- Modify: `frontend/src/pages/UploadDataPage.tsx`

- [ ] **Step 1: 网格映射**

固定 72 格：index 0..71
- 第 i 局对应 index i-1

- [ ] **Step 2: 点击循环**

对格子 index=k：
- 若 k >= results.length：点击第一次填充为 '庄'，并将 results 填到 k+1 长度（中间补齐默认值不允许；因此只允许点击“下一个格子”或提供自动补齐策略）

为保持“必须连续从第 1 局开始”，建议实现：
- 仅允许点击 `index <= results.length`（允许点击下一个空格追加）
- 点击已存在格子循环：庄→闲→和→空（空则删除该格及其后续尾部连续空）

- [ ] **Step 3: 双向同步**

当 results 由 QuickKeyInput 改变时，BeadGridInput 根据 results 渲染。

---

## Task 5: UploadConfirmModal（动作/余额/深度学习选项 + 勾选确认）

**Files:**
- Create: `frontend/src/components/upload/UploadConfirmModal.tsx`
- Modify: `frontend/src/pages/UploadDataPage.tsx`

- [ ] **Step 1: Modal 字段**

字段：
- balanceMode: 'keep' | 'reset_default'
- action: 'reset_current_boot' | 'new_boot'
- runDeepLearning: boolean（仅 action=new_boot 可见，默认 true）
- confirmCheckbox: boolean（仅 action=reset_current_boot 必须勾选）

- [ ] **Step 2: 摘要区**

在弹窗中展示：
- 当前靴号（从 systemState 拉取）
- 当前已开局数（从 systemState 拉取）
- 将写入新局数 N（results.length）
- 动作与余额方式

- [ ] **Step 3: 提交按钮启用条件**

- action=reset_current_boot：必须勾选确认框才可点“确认上传”

---

## Task 6: 前端 API 对接（扩展 uploadGameResults）

**Files:**
- Modify: [api.ts](file:///workspace/frontend/src/services/api.ts)
- Modify: `frontend/src/pages/UploadDataPage.tsx`

- [ ] **Step 1: 扩展 API 方法签名**

新增方法：

```ts
export type UploadMode = 'reset_current_boot' | 'new_boot';
export type BalanceMode = 'keep' | 'reset_default';

export const uploadGameResultsV2 = async (params: {
  games: GameUploadItem[];
  mode: UploadMode;
  balance_mode: BalanceMode;
  run_deep_learning?: boolean;
}) => api.post('/games/upload', params);
```

- [ ] **Step 2: UploadDataPage 调用**

把 results 转换为 games（1..N）并提交：
- 成功后 navigate('/dashboard')

---

## Task 7: 后端 upload service 语义修复与扩展

**Files:**
- Modify: `backend/app/services/game/upload.py`

- [ ] **Step 1: 拆分 upload 语义**

在 service 层引入明确分支：
- reset_current_boot：允许 first_game_number=1，必须清场本靴数据后写入
- new_boot：必须 first_game_number=1，boot_number+1 后写入

彻底移除“not is_new_boot 时要求 first_game_number==next_game_number 且又清场”的矛盾。

- [ ] **Step 2: balance_mode**

在 reset_current_boot / new_boot 两种分支中都支持：
- keep：保持 sess.balance
- reset_default：sess.balance=settings.DEFAULT_BALANCE，并同步写入 SystemState

---

## Task 8: 后端路由扩展（game.py）

**Files:**
- Modify: `backend/app/api/routes/game.py`

- [ ] **Step 1: 扩展请求体**

为 `/games/upload` 路由新增字段：
- mode
- balance_mode
- run_deep_learning

并透传给 upload service。

---

## Task 9: new_boot 下可选 end_boot 深度学习

**Files:**
- Modify: `backend/app/api/routes/game.py` 或 `backend/app/services/game/upload.py`

- [ ] **Step 1: 调用顺序**

当 mode=new_boot 且 run_deep_learning=true：
- 先调用 end_boot（复用已有校验：无未开奖注单、至少 N 局等）
- 等到状态允许新靴后再写入新靴数据

当 run_deep_learning=false：
- 直接新靴写入（跳过 end_boot）

---

## Task 10: 后端测试

**Files:**
- Create: `backend/tests/test_upload_modes.py`

- [ ] **Step 1: reset_current_boot**

写入 boot=1 的旧数据后执行 reset_current_boot，断言：
- boot 仍为 1
- 旧表数据被清空并被新数据替换

- [ ] **Step 2: new_boot（skip deep learning）**

断言 boot_number+1 且旧靴数据保留。

---

## Task 11: E2E 手工验收

- [ ] 进入 Dashboard 点击“上传数据” → 进入 /upload
- [ ] 键盘输入 112233，珠盘格与列表同步
- [ ] 选择“重置本靴 + 勾选确认 + 保留余额”提交，Dashboard 回到分析流程
- [ ] 选择“结束本靴 + 执行深度学习”提交，完成后进入新靴流程

