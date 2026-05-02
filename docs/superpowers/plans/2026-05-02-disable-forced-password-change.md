# 取消“必须先改密码”强制流程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 登录后不再强制弹出/跳转“修改默认密码”，而是直接进入模式选择页；修改密码功能仍保留在管理页供手动使用。

**Architecture:** 仅调整前端登录成功后的跳转与管理页“自动弹改密”的触发条件，不改后端鉴权与密码修改接口。

**Tech Stack:** React + Ant Design + React Router。

---

### Task 1: 登录后不再因 must_change_password 分支跳转到 /admin

**Files:**
- Modify: `/workspace/frontend/src/hooks/useAdminLogin.ts`
- Modify: `/workspace/frontend/src/components/admin/LoginModal.tsx`

- [ ] **Step 1: 修改 useAdminLogin 的跳转逻辑**

将原本：
- must_change_password=true 时跳 `/admin`
- 否则跳 `/mode`

改为：**无论是否 must_change_password，都跳 `/mode`**。

- [ ] **Step 2: 修改 LoginModal 的跳转逻辑**

将原本 must_change_password=true 时跳 `/admin` 的逻辑移除，登录成功后统一跳 `/mode`。

- [ ] **Step 3: 运行前端 build 验证**

Run:
```bash
cd /workspace/frontend && npm run build
```
Expected: build success.

---

### Task 2: 取消管理页“自动弹改密”（如果存在）

**Files:**
- Inspect/Modify: `/workspace/frontend/src/pages/AdminPage.tsx`

- [ ] **Step 1: 检查是否有根据 route state 自动打开改密弹窗**

若存在类似 `location.state.mustChangePassword` 触发自动弹窗逻辑，删除该自动弹窗行为（保留“修改密码”按钮入口）。

- [ ] **Step 2: 浏览器冒烟验证**

验证：登录后直接进入 `/mode`；进入 `/admin` 不会强制弹改密弹窗；手动点击“修改密码”仍可正常打开。

