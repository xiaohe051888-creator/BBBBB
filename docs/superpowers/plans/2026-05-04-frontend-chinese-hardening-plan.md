# 前端用户可见内容全中文化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将前端所有用户可见文案统一为中文显示，仅保留 `AI`、`API` 缩写。

**Architecture:** 采用“显示层收口”方案，不改后端字段与内部变量名，只在前端页面、组件和提示映射层统一中文化。先处理高频页面与通用弹窗，再清理裸露英文占位符、错误提示和结果标签，最后通过构建与诊断验证无回归。

**Tech Stack:** React、TypeScript、Ant Design、Vite、Vitest

---

### Task 1: 盘点并锁定首批高频问题

**Files:**
- Modify: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/src/components/dashboard/RevealModal.tsx`
- Modify: `frontend/src/components/admin/ApiConfigModal.tsx`
- Modify: `frontend/src/components/admin/LoginModal.tsx`
- Modify: `frontend/src/pages/ModeSelectPage.tsx`

- [ ] 识别用户高频可见英文与技术口径外露点。
- [ ] 记录单 AI 配置区、开奖结果弹窗、接口配置弹窗、模式页的改造边界。

### Task 2: 收口单 AI 配置区的中文显示

**Files:**
- Modify: `frontend/src/pages/AdminPage.tsx`

- [ ] 将单 AI 提示词区的说明、占位提示、默认模板文案改为中文解释。
- [ ] 将技术占位符保留在模板内容中，但界面说明改为普通用户可理解的中文。
- [ ] 将可能直接外露的英文模式值映射为中文显示。

### Task 3: 清理弹窗和关键操作反馈

**Files:**
- Modify: `frontend/src/components/dashboard/RevealModal.tsx`
- Modify: `frontend/src/components/admin/ApiConfigModal.tsx`
- Modify: `frontend/src/components/admin/LoginModal.tsx`
- Modify: `frontend/src/pages/ModeSelectPage.tsx`

- [ ] 去掉开奖结果弹窗中的 `Banker`、`Player`、`Tie`。
- [ ] 优化接口配置弹窗对模型、地址、测试结果的中文提示。
- [ ] 保证登录、模式切换、测试连通性等关键反馈全部为中文。

### Task 4: 补充必要的中文映射测试

**Files:**
- Create or Modify: `frontend/src/utils/i18nErrors.test.ts`
- Modify: `frontend/src/utils/i18nErrors.ts`

- [ ] 为新增或调整的错误映射补充聚焦测试。
- [ ] 先让测试失败，再补最小实现，保证英文错误不会直接透传给用户。

### Task 5: 构建与诊断回归

**Files:**
- Verify: `frontend/src/pages/AdminPage.tsx`
- Verify: `frontend/src/components/dashboard/RevealModal.tsx`
- Verify: `frontend/src/components/admin/ApiConfigModal.tsx`
- Verify: `frontend/src/components/admin/LoginModal.tsx`
- Verify: `frontend/src/pages/ModeSelectPage.tsx`

- [ ] 运行前端测试与构建。
- [ ] 检查最近编辑文件诊断信息。
- [ ] 如开发服务器需要刷新，确认最新预览可用。
