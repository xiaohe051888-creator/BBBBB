# 历史 mode 兜底 + 文档端口清理 + 测试日志静音 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 历史记录 prediction_mode 为空时统一兜底显示为 rule；SQLite 自动迁移不再把 NULL 回填为 ai；清理文档里残留的旧端口描述；静音测试中故意触发的异常堆栈输出，保持 CI 日志干净。

**Architecture:**  
1) 不强行改历史数据，只在 API 输出层把 `NULL/空字符串` 映射为 `rule`。  
2) 自动迁移只修“结构缺失”，不再写业务默认值到历史记录。  
3) 文档文本修正：统一为 8001（仅文档，不影响运行）。  
4) 测试静音：测试用例内临时 `logging.disable(logging.CRITICAL)`，不改变业务代码日志级别。

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + unittest。

---

### Task 1: API 输出层 prediction_mode 兜底为 rule

**Files:**
- Modify: [schemas.py](file:///workspace/backend/app/models/schemas.py)
- Modify: `/workspace/backend/app/api/routes/*.py`（返回 GameRecord/MistakeBook 的接口）

- [ ] 找到所有返回 GameRecord/MistakeBook 的接口，在序列化时将 `None/""` 映射为 `"rule"`。

---

### Task 2: SQLite auto-migrate 不再回填历史 prediction_mode

**Files:**
- Modify: [database.py](file:///workspace/backend/app/core/database.py#L99-L140)

- [ ] 移除/改写 `UPDATE game_records/mistake_book/model_versions prediction_mode = 'ai' ...` 的自动回填逻辑（保留建表/加列）。

---

### Task 3: 清理文档里残留的旧端口描述

**Files:**
- Modify: `/workspace/docs/**/*.md`（包含历史 plans/specs）

- [ ] 将文档中默认端口描述更新为 8001。

---

### Task 4: 静音测试里故意触发的异常堆栈输出

**Files:**
- Modify: [test_ai_analysis_fallbacks.py](file:///workspace/backend/tests/test_ai_analysis_fallbacks.py#L44-L82)

- [ ] 在 `test_ai_analyze_exception_does_not_deadlock` 用例中临时关闭 logging（finally 恢复）。

---

### Task 5: 全量回归

- [ ] Backend tests

```bash
mkdir -p /workspace/data
python -m unittest discover -s backend/tests -p 'test_*.py' -v
```
