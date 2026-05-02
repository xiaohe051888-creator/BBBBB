# 全面深度检查报告（第三轮：P3 细节修复后复核）

目标：从 0→100 视角复核“主流程 + 管理维护 + 运维可观测性”  
范围：dashboard / mode / admin / logs / maintenance API / ws  
结论：功能主流程稳定，维护面板与告警条可用；第二轮发现的 4 个 P3 细节问题已全部修复并复核通过。

## 概要

- P1（阻断）：0
- P2（影响使用/安全）：0
- P3（体验/一致性/易用性/可观测性）：0

## ISSUE-001（P3）：维护统计在首次进入时可能短暂显示“自动清理关闭”（已修复）

**现象**  
维护统计未加载完成前，标签默认展示“自动清理 关闭”（实际上只是数据尚未到达），容易误导。

**复现步骤**  
1. 管理页 → 数据库存储  
2. 刚进入页面瞬间观察“自动清理”标签

**建议修复**  
未加载完成时显示“加载中/--”，而不是默认“关闭”。

**修复验证**  
`自动清理` 标签在数据未到达时显示“加载中”。证据：`dogfood-output-2/screenshots/admin-maintenance-after-fixes.png`

---

## ISSUE-002（P3）：Dashboard 告警条点击条目只跳转到 P1 列表，无法定位到具体日志（已修复）

**现象**  
点击某条 P1 事件，只能跳转到 `/dashboard/logs?priority=P1`，无法进一步按 `id` 或 `event_code` 定位到该条。

**建议修复**  
点击条目跳转 `/dashboard/logs?priority=P1&q=<event_code>` 或支持 `log_id` 精确定位。

**修复验证**  
现在支持按 `event_code` 携带 `q` 参数跳转并筛选。证据：`dogfood-output-2/screenshots/logs-page-p1-q-watchdog.png`

---

## ISSUE-003（P3）：maintenance/retention/run 没有“二次确认描述”区分日志与历史裁剪影响范围（已修复）

**现象**  
弹窗确认文本比较笼统，用户可能不了解“会删除哪些表/保留多少条”。

**建议修复**  
在确认弹窗补充当前配置摘要（P2/P3 天数、MAX_HISTORY_RECORDS）。

**修复验证**  
确认弹窗展示当前配置摘要。证据：`dogfood-output-2/screenshots/admin-retention-confirm-with-config.png`

---

## ISSUE-004（P3）：maintenance stats 的 sqlite_size_bytes 对非标准 sqlite URL 解析可能失败（已修复）

**现象**  
若 DATABASE_URL 使用相对路径或包含额外参数，文件路径解析可能不稳定（当前做了兼容，但仍可能存在边界）。

**建议修复**  
更稳妥方式：从 SQLAlchemy engine 取实际 sqlite 文件路径（或在 settings 中显式提供 DB_FILE_PATH）。

**修复验证**  
已改为基于 SQLAlchemy URL 解析数据库路径并做相对路径兼容。
