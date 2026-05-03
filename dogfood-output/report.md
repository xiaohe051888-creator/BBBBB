# Dogfood Report: Baccarat System (localhost:8011)

| Field | Value |
|-------|-------|
| **Date** | 2026-05-03 |
| **App URL** | http://localhost:8011 |
| **Scope** | 全站关键流程：登录、实盘日志、AI配置测试与启用、实时推送 |
| **Automation Coverage** | 后端集成接口 + WebSocket + 前端单元测试（受环境限制，无法进行真实浏览器端到端点击录屏） |

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 1 |
| **Total** | **1** |

## Issues

### ISSUE-001: 管理员登录弹窗导致闪屏（已修复）

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | ux |
| **URL** | /dashboard/logs |
| **Evidence** | N/A（会话内修复，未能录屏） |

**Description**

Dashboard 页面曾在未登录时自动弹管理员登录弹窗；当页面因 401 或路由回跳被重复加载时，导致弹窗反复闪烁，影响正常使用。

**Fix**

移除 Dashboard 的“未登录自动弹窗”逻辑，仅在用户触发需要权限的操作时弹窗。

---

### ISSUE-002: 401 自动跳转导致循环回跳闪屏（已修复）

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | functional |
| **URL** | 全站（接口 401 场景） |
| **Evidence** | N/A |

**Description**

接口返回 401 时会清理 token 并跳转首页；在“没有 token 的场景”也触发跳转会造成循环回跳。

**Fix**

仅在“确实存在 token”的情况下执行清理与跳转；无 token 场景不跳转。

---

### ISSUE-003: 实盘日志页面“刷新/导出”失败时无反馈（已修复）

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | ux |
| **URL** | /dashboard/logs |
| **Evidence** | N/A |

**Description**

未登录或接口失败时，用户点击刷新/导出会误以为按钮无效。

**Fix**

刷新与导出在未登录/失败/下载被阻止时提供明确中文提示；自动刷新改为静默刷新避免频繁 toast。

---

### ISSUE-004: 日志时间未统一按北京时间展示（已修复）

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | content |
| **URL** | /dashboard/logs、首页告警条 |
| **Evidence** | N/A |

**Fix**

前端统一将日志时间转换为北京时间（UTC+8）展示。

---

### ISSUE-005: “测试连通性”错误处理与启用门禁不一致（已修复）

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | functional |
| **URL** | /admin（接口配置弹窗） |
| **Evidence** | N/A |

**Description**

前端之前只要 HTTP 200 就判定测试通过；后端返回 success=false 时仍显示成功。并且 API key 留空（使用已保存 key）会导致“测试通过但无法启用模式”的哈希不一致问题。

**Fix**

前端严格校验返回体 success 字段；后端测试与启用门禁对齐使用同一套配置哈希规则，并支持测试时使用已保存 key。

---

### ISSUE-006: “保存配置”会关闭弹窗，影响用户继续测试（已修复）

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | ux |
| **URL** | /admin（接口配置弹窗） |
| **Evidence** | N/A |

**Fix**

保存后弹窗保持打开，允许用户直接点“测试连通性”。

---

### ISSUE-007: 存在少量英文错误信息（部分修复）

| Field | Value |
|-------|-------|
| **Severity** | low |
| **Category** | content |
| **URL** | /admin（接口配置） |
| **Evidence** | N/A |

**Status**

已修复一处后端错误信息（Invalid role -> 角色参数非法）。仍建议对剩余边缘英文错误持续做统一中文化。
