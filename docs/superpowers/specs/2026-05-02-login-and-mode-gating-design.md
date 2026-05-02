# 登录即用 + 模式选择门槛（AI 需已测试通过）设计

日期：2026-05-02  
面向用户：单人使用（你自己），但要求“需要登录才可以使用系统”，并且 AI 模式只能在“已配置且测试通过”时才允许选择。

## 目标体验（你描述的流程）

1. 打开系统  
2. 弹出登录框（可关闭以继续浏览只读页面）  
3. 登录成功后进入“模式选择”页面  
4. 规则引擎：无需配置，永远可选  
5. AI 模式：必须“已配置 API + 测试通过”才可选  
6. 选择好模式后才进入系统（Dashboard）

## 关键规则

### 1) 登录门槛（你已选择：可看但不能操作）

- 未登录允许访问：总览/走势/只读数据展示页面  
- 需要写操作的入口（上传/开奖/切换模式/管理面板/WS 实时推送）必须登录后才能用

### 2) AI 可选门槛：配置 + 测试通过

AI 模式允许启用的条件为：

- **3AI 模式**：banker/player/combined 三个角色都满足：
  - api_key_set = true
  - last_test_ok = true
- **单 AI 模式**：single 角色满足：
  - api_key_set = true
  - last_test_ok = true
- **规则模式**：永远允许启用

### 3) “测试通过永久有效”（你选择 A）

- 一旦某个角色的配置测试通过，就认为可用
- 只有当该角色的配置被修改（provider/model/base_url/api_key 任一变化）时，才将 last_test_ok 重置为 false，要求重新测试

## 后端设计

### 数据持久化

在“API 配置”对应的数据库记录上增加字段（或新增一张轻量表按 role 保存）：
- last_test_ok: bool
- last_test_at: datetime | null
- last_test_error: str | null（仅保存简短错误原因）

并在更新配置时执行：
- last_test_ok = false
- last_test_at = null
- last_test_error = null

### API 行为

1) `/api/admin/api-config/test`
- 测试成功：写入 last_test_ok=true, last_test_at=now, last_test_error=null
- 测试失败：写入 last_test_ok=false, last_test_at=now, last_test_error=简短原因

2) `/api/admin/three-model-status`
- 返回每个角色除了 api_key_set 之外，还需要带回 last_test_ok/last_test_at/last_test_error
- 额外返回两个聚合字段：
  - ai_ready_for_enable（3AI 是否可启用）
  - single_ai_ready_for_enable（单 AI 是否可启用）

3) `/api/system/prediction-mode`
- 后端作为最终门禁：当 mode=ai 或 single_ai 时，如果未满足“配置+测试通过”，返回 409，并给出中文原因

## 前端设计

### 路由与引导页

- 新增页面：`/mode`（模式选择页）
- 登录成功后：自动跳转到 `/mode`
- 在 `/mode` 选定模式后：调用 `/api/system/prediction-mode` 成功后跳转到 `/dashboard`

### 登录弹窗策略

- 首次进入系统：如果无 token，自动弹出登录弹窗  
- 用户可关闭弹窗继续浏览只读页面（符合“可看但不能操作”）  
- 当用户点击写操作（上传/开奖/管理）时：
  - 若无 token：弹登录弹窗并阻止继续操作

### 模式按钮禁用策略

- “规则模式”按钮永远可点
- “3AI 模式”按钮仅当 `ai_ready_for_enable=true` 才可点；否则置灰并显示提示：“请先配置并测试通过：庄/闲/综合模型”
- “单 AI 模式”按钮仅当 `single_ai_ready_for_enable=true` 才可点；否则置灰并提示：“请先配置并测试通过：单模型”

## 验收标准

1. 未登录：可看总览/走势；点击上传/开奖/管理时必须先登录  
2. 登录成功：进入 `/mode`，必须选定模式才进入 dashboard  
3. AI 模式：未测试通过时按钮不可点；即使前端误点，后端也会拒绝启用并返回中文原因  
4. 规则模式：永远可选且启用成功  
5. 修改 API 配置后：对应角色 last_test_ok 自动重置，必须重新测试才能启用 AI 模式

