# 2026-05-07 Final Hardening And Acceptance Design

## Goal

在不继续扩大业务范围的前提下，完成系统最后一阶段的高收益完善工作。

本阶段只做两类事情：

1. 关键验收补强
2. 高收益结构收口

目标不是继续大规模重构，而是把当前版本推进到“主链路可验收、结构风险已收敛、可稳定交付”的状态。

## Scope

### In Scope

- 补强 4 条关键链路的验证与闭环：
  - 管理员登录
  - API 配置保存
  - 模式切换
  - 启动恢复
- 对后端启动编排和重模块边界做小范围高收益收口
- 为新增 helper、共享逻辑和关键链路补测试
- 保持现有行为语义不变，只降低重复实现和维护风险

### Out Of Scope

- 不新增业务功能
- 不继续做全站文案清理
- 不做大规模文件拆分
- 不为了“更优雅”继续做低收益抽象
- 不修改已稳定的交互语义和接口协议

## Current Context

经过前几轮清理，以下问题已经收敛：

- 前后端胜率协议不一致已修复
- 默认模式回退冲突已修复
- API 配置弹窗关闭闭环已修复
- 前端旧工作流状态机暴露已移除
- 前端过时兼容类型导出已移除
- 后端 `.env` 写回分叉已统一为公共 helper
- 后端启动模式规范化、状态 seed 生成、seed 应用和启动编排均已抽成共享 helper

当前剩余工作的重点不再是“找新的冲突”，而是把最后阶段的关键链路验证补齐，并对少量高价值结构债做收口。

## Recommended Approach

### Option A: Only Add Acceptance Coverage

只补关键链路测试，不再做结构整理。

优点：

- 最快增加交付信心
- 风险最低

缺点：

- `main.py` 与 `auth.py` 的复杂度仍偏高
- 后续维护成本不会继续下降

### Option B: Acceptance First, Then Small High-Value Refactor

先补关键验收链路，再做一轮小范围结构收口。

优点：

- 交付风险和维护收益最平衡
- 既补验证，也把高频维护热点进一步压缩

缺点：

- 比只补测试多一轮实施

### Option C: Keep Refactoring Deeper

继续向更大范围结构整理推进。

优点：

- 代码会更整洁

缺点：

- 收益已经明显下降
- 容易进入低收益重构
- 不利于尽快稳定收口

### Recommendation

采用 Option B。

本阶段定义为：

1. 先补关键验收链路
2. 再做一轮边界明确、收益明确的小范围收口
3. 完成后停止继续重构，转入交付判断

## Design

### 1. Acceptance Coverage Workstream

这一工作流专门覆盖“用户真正关心系统是否能用”的主链路。

本阶段必须覆盖的 4 条链路：

- 管理员登录
- API 配置保存
- 模式切换
- 启动恢复

覆盖要求：

- 优先使用后端接口级验证和前端关键状态流转验证
- 能使用现有测试基础设施的，延续现有模式
- 不能在当前环境跑通完整集成的，至少补到纯逻辑 + 服务层 + 可重复执行路径

通过标准：

- 每条链路都有明确验证载体
- 结果可重复
- 不依赖“人工感觉应该没问题”

### 2. Backend Hardening Workstream

这一工作流只处理高收益结构问题，不再做新的大拆分。

收口重点：

- `main.py` 启动编排
- `auth.py` 中职责过于集中的部分

处理原则：

- 只抽共享步骤，不改语义
- 只收口已确认的重复逻辑
- 所有变化都要有定向测试保护

停止条件：

- 主流程文件中的重复实现被降到可接受水平
- 继续拆分不会再明显降低风险

### 3. Frontend Hardening Workstream

前端本阶段不继续做大规模文案或组件结构整理，只做关键链路闭环验证。

重点关注：

- API 配置保存后的状态刷新
- 模式切换后的状态一致性
- 管理页面与首页状态感知是否一致

处理原则：

- 优先验证已有实现是否真的闭环
- 只在验证暴露缺口时做最小修复

## Components And Responsibilities

### Backend

- `backend/app/api/main.py`
  - 只保留启动步骤顺序与生命周期编排
- `backend/app/services/startup_state.py`
  - 负责启动状态 seed 生成、模式规范化组合、seed 应用和启动编排辅助
- `backend/app/api/routes/auth.py`
  - 继续承载现有管理接口，但仅在高收益点继续收口
- `backend/tests/*`
  - 为关键链路和共享 helper 提供回归保护

### Frontend

- `frontend/src/services/api.ts`
  - 保持为关键管理链路调用入口
- `frontend/src/pages/AdminPage.tsx`
  - 验证配置保存、模式切换、状态刷新闭环
- `frontend/src/components/admin/*`
  - 补关键流转相关测试或最小修复

## Data And Control Flow

### Startup Recovery Flow

1. 读取 `SystemState`
2. 将数据库快照应用到内存 session
3. 根据当前密钥配置生成规范后的启动 seed
4. 若模式需回退，则写回数据库
5. 将规范 seed 应用到内存 session
6. 再执行恢复相关逻辑，如余额同步和待开奖恢复

### API Config Save Flow

1. 前端提交配置
2. 后端写入 `.env` 与相关状态表
3. 前端刷新模型状态
4. UI 状态与可启用性保持一致

### Prediction Mode Switch Flow

1. 前端发起模式切换
2. 后端执行 gate 校验
3. 数据库与内存 session 同步更新
4. 前端刷新展示状态

## Error Handling

- 现有错误语义保持不变
- 新增 helper 不吞异常，只负责收口流程
- 对环境依赖不足导致的测试限制，要明确区分为“环境限制”而非“功能失败”
- 若补测过程中发现行为冲突，优先回到已有 helper 边界修复，不重新把逻辑塞回路由或页面

## Testing Strategy

### Must Add Or Strengthen

- 管理员登录关键成功/失败路径
- API 配置保存后的状态更新
- 模式切换后的 gate 与状态闭环
- 启动恢复的主路径一致性

### Keep Using

- 纯逻辑 helper 测试
- 后端定向 pytest
- 前端定向 vitest
- 语法/构建校验

### Validation Standard

- 新增或改动的共享 helper 必须有失败后再转绿的测试
- 每个关键链路至少有一个可以稳定复现的验证点
- 不新增明显 lint、类型或语法问题

## Risks

### Risk 1: Over-Refactor

如果继续扩大范围，容易进入低收益重构。

应对：

- 只处理已确认的高收益点
- 每轮结束都检查是否还在解决真实问题

### Risk 2: Environment-Limited Integration Tests

当前沙箱可能缺少部分后端依赖，导致部分接口级测试不能完整跑通。

应对：

- 当前环境先补纯逻辑和可运行部分
- 保留最终验收清单用于完整环境复跑

### Risk 3: Startup Sequence Sensitivity

启动链对顺序较敏感，重构时容易引入细小回归。

应对：

- 只抽 helper，不改步骤顺序
- 用共享 seed/helper 代替重复内联逻辑

## Acceptance Criteria

- 关键 4 条链路均有明确验证
- `main.py` 不继续膨胀，启动编排职责更清晰
- 不引入新的协议冲突、模式冲突或闭环缺失
- 当前版本可以基于测试与结构状态做“可交付”判断

## Execution Boundary

本设计一旦执行完成，即视为本轮“系统完善”收口。

收口后不再继续做新的结构性重构，除非发现新的主流程问题或用户明确要求进入下一轮架构演进。
