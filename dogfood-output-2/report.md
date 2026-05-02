# 全面深度检查报告（第二轮：维护/告警能力上线后）

目标：从 0→100 视角复核“主流程 + 管理维护 + 运维可观测性”  
范围：dashboard / mode / admin / logs / maintenance API / ws  
结论：功能主流程稳定，新增维护面板与告警条可用；剩余 4 个低风险改进点（0 个阻断）。

## 概要

- P1（阻断）：0
- P2（影响使用/安全）：0
- P3（体验/一致性/易用性/可观测性）：4

## ISSUE-001（P3）：维护统计在首次进入时可能短暂显示“自动清理关闭”

**现象**  
维护统计未加载完成前，标签默认展示“自动清理 关闭”（实际上只是数据尚未到达），容易误导。

**复现步骤**  
1. 管理页 → 数据库存储  
2. 刚进入页面瞬间观察“自动清理”标签

**建议修复**  
未加载完成时显示“加载中/--”，而不是默认“关闭”。

---

## ISSUE-002（P3）：Dashboard 告警条点击条目只跳转到 P1 列表，无法定位到具体日志

**现象**  
点击某条 P1 事件，只能跳转到 `/dashboard/logs?priority=P1`，无法进一步按 `id` 或 `event_code` 定位到该条。

**建议修复**  
点击条目跳转 `/dashboard/logs?priority=P1&q=<event_code>` 或支持 `log_id` 精确定位。

---

## ISSUE-003（P3）：maintenance/retention/run 没有“二次确认描述”区分日志与历史裁剪影响范围

**现象**  
弹窗确认文本比较笼统，用户可能不了解“会删除哪些表/保留多少条”。

**建议修复**  
在确认弹窗补充当前配置摘要（P2/P3 天数、MAX_HISTORY_RECORDS）。

---

## ISSUE-004（P3）：maintenance stats 的 sqlite_size_bytes 对非标准 sqlite URL 解析可能失败

**现象**  
若 DATABASE_URL 使用相对路径或包含额外参数，文件路径解析可能不稳定（当前做了兼容，但仍可能存在边界）。

**建议修复**  
更稳妥方式：从 SQLAlchemy engine 取实际 sqlite 文件路径（或在 settings 中显式提供 DB_FILE_PATH）。

