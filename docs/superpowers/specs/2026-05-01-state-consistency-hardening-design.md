# 状态一致性加固设计（JWT 固化 / DB 路径固定 / 严格不降级）

日期：2026-05-01  
动机：消除“重启后像是丢配置/丢数据/模式不一致”的问题，让系统的行为可预测、可解释。

## 背景问题

1. **JWT_SECRET_KEY 默认每次启动随机生成**  
   导致服务重启后历史 token 全失效，表现为“刚登录/刚配置，刷新后又要重新登录”。

2. **SQLite 默认使用相对路径**（`sqlite+aiosqlite:///./data/baccarat.db`）  
   启动工作目录变化时可能读到不同的数据库文件，表现为“数据没了/状态没了”。

3. **模式降级逻辑与 UI/诊断/门禁不一致**  
   历史逻辑存在“缺 key 自动降级到规则”的路径，容易出现“用户以为是 3AI/单AI，但实际已经降级”的语义混乱。

## 决策（来自本轮对齐）

- 降级策略：**严格不降级**  
  - 缺 key 时不允许切换到对应模式  
  - 已处于该模式且缺 key 时：分析直接阻止执行并返回明确错误（不切换模式、不输出其它引擎结果）

## 目标

1. JWT_SECRET_KEY 只要第一次生成后就持久化，重启不变（不输出密钥到日志）
2. SQLite 默认路径固定到项目内确定位置，避免不同启动方式读到不同 DB
3. 模式切换与分析执行在后端也做严格门禁（不依赖前端）
4. 诊断与 UI 提示保持一致、中文化、可解释

## 方案概述（推荐方案）

### A）JWT_SECRET_KEY 固化（首次启动自动生成并写入 backend/.env）

- 启动时检测 `JWT_SECRET_KEY`：
  - 若环境变量/`.env` 未配置，则生成一次随机值并写入 `backend/.env`
  - 后续启动直接读取已写入的值，不再变化
- 安全要求：
  - 日志中只提示“已生成/已存在”，绝不打印密钥值

### B）SQLite DATABASE_URL 默认值固定（仍允许外部 DATABASE_URL 覆盖）

- 规则：
  - 若设置了 `DATABASE_URL`：完全尊重该值（生产/容器）
  - 否则默认使用：`sqlite+aiosqlite:///<ABS_PATH_TO_BACKEND>/data/baccarat.db`
- 保证：
  - 不再依赖当前工作目录
  - 与现有 `backend/data/baccarat.db` 位置一致

### C）严格不降级：后端模式门禁 + 分析门禁

1. `POST /api/system/prediction-mode`：
   - 切到 `ai`：必须 OPENAI/ANTHROPIC/GEMINI 三项均配置，否则返回 400（中文提示）
   - 切到 `single_ai`：必须 SINGLE_AI_API_KEY 配置，否则返回 400
   - 切到 `rule`：永远允许

2. 分析执行路径（`run_ai_analysis`）：
   - 若当前模式所需 key 缺失：
     - 不写入任何“降级模式”
     - 返回明确的“阻止执行”结果（例如 `analysis_blocked: true`），并提示“请配置密钥或切换模式”
     - 确保不会卡死在“分析中”（保留安全回退结构，但不切换引擎）

3. 测试策略：
   - 替换现有“缺 key 自动降级”的单元测试为“缺 key 阻止切换/阻止分析”的测试

## 影响范围

**Backend**
- 配置加载：`app/api/main.py`（启动阶段）
- 配置模块：`app/core/config.py`（DATABASE_URL 默认值）
- 模式切换：`app/api/routes/system.py`（prediction-mode）
- 分析服务：`app/services/game/analysis.py`（移除自动降级写入 prediction_mode 的行为）
- 测试：更新相关测试用例（原“自动降级”改为“严格阻止”）

**Frontend**
- 不强制改动（已有前端门禁），但后端门禁后前端提示会更一致

## 验收标准

1. 重启服务后，管理员无需重新登录（token 仍有效）
2. 不同启动方式都指向同一个 SQLite 文件（同一份数据/状态）
3. 未配置 3AI/单AI key 时：
   - 后端拒绝切换到对应模式
   - 分析不会自动降级到规则、不会悄悄改 prediction_mode
4. UI/诊断/接口返回的提示一致且为中文

