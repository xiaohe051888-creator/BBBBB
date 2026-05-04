# 前端全站移动端自适应 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变任何功能的前提下，完成前端全站移动端排版与布局适配。

**Architecture:** 采用“统一移动端骨架 + 页面级补丁”的方案。先收口公共样式和可复用类，再逐页处理总览、五路、日志、错题本、下注记录、上传页和管理员页的窄屏布局问题，最后通过构建与浏览器核查验证。

**Tech Stack:** React、TypeScript、Ant Design、CSS、Vite

---

### Task 1: 统一移动端基础骨架

**Files:**
- Modify: `frontend/src/styles/global.css`
- Modify: `frontend/src/styles/mobile.css`

- [ ] 调整页面容器、导航条、按钮、弹窗、表格卡片化、安全区等全局移动端样式。
- [ ] 保证手机竖屏下页面不发生全局横向溢出。

### Task 2: 适配总览页与五路页

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/pages/RoadMapPage.tsx`
- Modify: `frontend/src/components/dashboard/AnalysisPanel.tsx`
- Modify: `frontend/src/components/dashboard/WorkflowStatusBar.tsx`

- [ ] 将双栏布局在手机下切为单列。
- [ ] 优化五路图区、分析区、统计区和状态栏的窄屏排版。

### Task 3: 适配日志页、错题本、下注记录

**Files:**
- Modify: `frontend/src/pages/LogsPage.tsx`
- Modify: `frontend/src/pages/MistakeBookPage.tsx`
- Modify: `frontend/src/pages/BetRecordsPage.tsx`

- [ ] 收口筛选区、详情弹窗、统计区与表格卡片化布局。
- [ ] 保证按钮、筛选器和复制导出操作在手机下易点可读。

### Task 4: 适配上传页、管理员页、模式页

**Files:**
- Modify: `frontend/src/pages/UploadDataPage.tsx`
- Modify: `frontend/src/pages/AdminPage.tsx`
- Modify: `frontend/src/pages/ModeSelectPage.tsx`

- [ ] 优化多卡片、表单区、按钮组、文本域和顶部导航在手机下的单列排版。
- [ ] 保证管理后台和单AI模板区在移动端不挤压、不溢出。

### Task 5: 验证

**Files:**
- Verify: `frontend/src/styles/global.css`
- Verify: `frontend/src/styles/mobile.css`
- Verify: `frontend/src/pages/DashboardPage.tsx`
- Verify: `frontend/src/pages/RoadMapPage.tsx`
- Verify: `frontend/src/pages/LogsPage.tsx`
- Verify: `frontend/src/pages/MistakeBookPage.tsx`
- Verify: `frontend/src/pages/BetRecordsPage.tsx`
- Verify: `frontend/src/pages/UploadDataPage.tsx`
- Verify: `frontend/src/pages/AdminPage.tsx`
- Verify: `frontend/src/pages/ModeSelectPage.tsx`

- [ ] 运行前端 lint 与 build。
- [ ] 用浏览器按手机视口核查主要页面。
