# Single AI Prediction Prompt Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the single-AI formal prediction prompt so it always centers on reasoning about and predicting the next round as `庄` or `闲`, while keeping outputs stable for the strict parser.

**Architecture:** Keep the runtime, parser, and fallback workflow unchanged. Refactor prompt generation in `SingleModelService` into a contract-first structure, then align learning-generated single-AI templates to the same contract so both the default path and learned path target the same prediction objective.

**Tech Stack:** Python, FastAPI, SQLAlchemy, unittest/pytest, DeepSeek single-AI runtime

---

## File Map

- Modify: `backend/app/services/single_model_service.py`
  - Owns the default single-AI formal prediction prompt
  - Will gain a focused contract-first prompt builder or helper constants
- Modify: `backend/app/services/ai_learning_service.py`
  - Owns learned prompt template generation
  - Will align generated single-AI template with the new prediction contract
- Modify: `backend/tests/test_single_ai_analysis.py`
  - Owns single-AI runtime/prompt/parse behavior regression tests
- Modify: `backend/tests/test_single_ai_prompt_templates_api.py`
  - Owns prompt-template API persistence tests
  - Will add a learned-template compatibility regression if needed
- Create: `docs/superpowers/plans/2026-05-10-single-ai-prediction-prompt-refactor-implementation-plan.md`

## Task 1: Lock The Prompt Contract With Failing Tests

**Files:**
- Modify: `backend/tests/test_single_ai_analysis.py`
- Test: `backend/tests/test_single_ai_analysis.py`

- [ ] **Step 1: Write the failing test for the default prompt’s core objective**

Add this test below `test_single_ai_default_prompt_requires_strict_json_without_markdown`:

```python
    def test_single_ai_default_prompt_centers_on_predicting_next_round_side(self):
        from app.services.single_model_service import SingleModelService

        prompt = SingleModelService()._build_prompt(
            game_number=8,
            boot_number=12,
            game_history=[{"game_number": 1, "result": "庄"}],
            road_data={"big_road": []},
            mistake_context=[],
            consecutive_errors=1,
            road_features={"pattern": "单跳"},
        )

        self.assertIn("预测下一局", prompt)
        self.assertIn("你只能在 `庄` 和 `闲` 中二选一".replace("`", ""), prompt.replace("`", ""))
        self.assertIn("你的任务不是讨论是否预测，而是完成预测", prompt)
```

- [ ] **Step 2: Write the failing test for forced side selection under conflict**

Add this test immediately after the previous one:

```python
    def test_single_ai_default_prompt_forbids_no_decision_language(self):
        from app.services.single_model_service import SingleModelService

        prompt = SingleModelService()._build_prompt(
            game_number=9,
            boot_number=12,
            game_history=[{"game_number": 1, "result": "闲"}],
            road_data={"big_road": []},
            mistake_context=[],
            consecutive_errors=2,
            road_features={"pattern": "混合"},
        )

        self.assertIn("即使信号冲突，也必须选庄或闲", prompt)
        self.assertIn("不允许输出“无法判断”", prompt)
        self.assertIn("只能通过降低 confidence 表达不确定性", prompt)
```

- [ ] **Step 3: Write the failing test for the structured output contract**

Add this test after the previous one:

```python
    def test_single_ai_default_prompt_requires_contract_fields_for_prediction_reasoning(self):
        from app.services.single_model_service import SingleModelService

        prompt = SingleModelService()._build_prompt(
            game_number=10,
            boot_number=12,
            game_history=[{"game_number": 1, "result": "庄"}],
            road_data={"big_road": []},
            mistake_context=[],
            consecutive_errors=0,
            road_features={"pattern": "长龙"},
        )

        self.assertIn('"final_prediction":"庄或闲"', prompt)
        self.assertIn('"reasoning_points"', prompt)
        self.assertIn('"reasoning_detail"', prompt)
        self.assertIn("最终只输出严格 JSON", prompt)
```

- [ ] **Step 4: Run the focused test file and confirm it fails for the new assertions**

Run:

```bash
python -m pytest backend/tests/test_single_ai_analysis.py -q
```

Expected:

```text
FAIL ... test_single_ai_default_prompt_centers_on_predicting_next_round_side
FAIL ... test_single_ai_default_prompt_forbids_no_decision_language
FAIL ... test_single_ai_default_prompt_requires_contract_fields_for_prediction_reasoning
```

- [ ] **Step 5: Commit the red tests**

```bash
git add backend/tests/test_single_ai_analysis.py
git commit -m "test: lock single-ai prediction prompt contract"
```

## Task 2: Refactor The Default Single-AI Prompt Builder

**Files:**
- Modify: `backend/app/services/single_model_service.py`
- Test: `backend/tests/test_single_ai_analysis.py`

- [ ] **Step 1: Introduce a focused helper that builds the contract-first formal prediction prompt**

In `backend/app/services/single_model_service.py`, add a helper near `_build_prompt()`:

```python
    def _build_prediction_contract_prompt(
        self,
        boot_number: int,
        game_number: int,
        game_history: list[dict[str, Any]],
        road_data: dict[str, Any],
        mistake_context: list[dict[str, Any]],
        consecutive_errors: int,
        road_features: Optional[dict[str, Any]] = None,
    ) -> str:
        encoded_road_data = jsonable_encoder(road_data)
        encoded_road_features = jsonable_encoder(road_features) if road_features else None
        encoded_mistakes = jsonable_encoder(mistake_context)
        return (
            "你是百家乐单AI正式预测模型。\n"
            "你的唯一任务，是基于当前靴历史、五路特征、五路走势和错题上下文，推理并预测下一局是庄还是闲。\n"
            "你正在预测下一局百家乐结果，你只能在庄和闲中二选一。\n"
            "你的任务不是讨论是否预测，而是完成预测。\n\n"
            "【决策规则】\n"
            "1. 先阅读五路特征摘要，再核对五路原始点位。\n"
            "2. 再结合历史结果与错题上下文，判断下一局更偏庄还是更偏闲。\n"
            "3. 即使信号冲突，也必须选庄或闲。\n"
            "4. 不允许输出“无法判断”“继续观察”“等待更多数据”。\n"
            "5. 如果把握不高，只能通过降低 confidence 表达不确定性。\n\n"
            "【输出契约】\n"
            "你可以先内部深度思考，但最终只输出严格 JSON。\n"
            "不要输出 Markdown，不要输出代码块，不要输出任何额外解释，不要输出 JSON 之外的任何前后缀。\n"
            "输出必须是一个 JSON 对象，字段如下：\n"
            '{"final_prediction":"庄或闲","confidence":0-1,"bet_tier":"保守/标准/激进","summary":"一句话说明为什么偏向这个方向","reasoning_points":["要点1","要点2"],"reasoning_detail":"解释为什么预测下一局是这个方向"}\n\n'
            "【输入数据】\n"
            f"靴号: {boot_number}\n"
            f"局号: {game_number}\n"
            f"连续失准: {consecutive_errors}\n"
            f"历史: {json.dumps(game_history, ensure_ascii=False)}\n"
            f"五路特征摘要: {json.dumps(encoded_road_features, ensure_ascii=False) if encoded_road_features else ''}\n"
            f"五路: {json.dumps(encoded_road_data, ensure_ascii=False)}\n"
            f"错题: {json.dumps(encoded_mistakes, ensure_ascii=False)}\n"
        )
```

- [ ] **Step 2: Make `_build_prompt()` delegate to the new helper**

Replace the current `_build_prompt()` body with:

```python
    def _build_prompt(
        self,
        game_number: int,
        boot_number: int,
        game_history: list[dict[str, Any]],
        road_data: dict[str, Any],
        mistake_context: list[dict[str, Any]],
        consecutive_errors: int,
        road_features: Optional[dict[str, Any]] = None,
    ) -> str:
        return self._build_prediction_contract_prompt(
            boot_number=boot_number,
            game_number=game_number,
            game_history=game_history,
            road_data=road_data,
            mistake_context=mistake_context,
            consecutive_errors=consecutive_errors,
            road_features=road_features,
        )
```

- [ ] **Step 3: Run the prompt-focused tests**

Run:

```bash
python -m pytest backend/tests/test_single_ai_analysis.py -q
```

Expected:

```text
... all prompt assertions PASS
```

- [ ] **Step 4: Run the existing parse-path contract regressions**

Run:

```bash
python -m pytest backend/tests/test_single_ai_analysis.py backend/tests/test_analysis_outcome_contract.py -q
```

Expected:

```text
all selected tests pass
```

- [ ] **Step 5: Commit the default prompt refactor**

```bash
git add backend/app/services/single_model_service.py backend/tests/test_single_ai_analysis.py
git commit -m "refactor: rebuild single-ai formal prediction prompt"
```

## Task 3: Align Learned Single-AI Templates With The Same Prediction Contract

**Files:**
- Modify: `backend/app/services/ai_learning_service.py`
- Modify: `backend/tests/test_single_ai_prompt_templates_api.py`
- Test: `backend/tests/test_single_ai_prompt_templates_api.py`

- [ ] **Step 1: Add a regression test for learned single-AI templates**

In `backend/tests/test_single_ai_prompt_templates_api.py`, add this test before `if __name__ == "__main__":`:

```python
    def test_generated_single_ai_learning_template_keeps_prediction_contract(self):
        from app.services.ai_learning_service import AILearningService

        service = AILearningService.__new__(AILearningService)
        template = service._generate_optimized_prompt_template(
            ai_analysis={
                "pattern_summary": "大路偏顺，下三路收敛",
                "error_patterns": "列尾误判偏多",
                "confidence_threshold_recommendation": "弱信号降置信度",
                "key_insight": "冲突盘面仍要完成选边",
            },
            key_changes="强化下一局选边约束",
            prediction_mode="single_ai",
        )

        self.assertIn("预测下一局", template)
        self.assertIn("只能在庄和闲中二选一", template)
        self.assertIn("即使信号冲突，也必须选庄或闲", template)
        self.assertIn('"final_prediction":"庄或闲"', template)
        self.assertIn('"reasoning_detail"', template)
```

- [ ] **Step 2: Rewrite the learned single-AI template generator to match the new contract**

In `backend/app/services/ai_learning_service.py`, replace the `prediction_mode == "single_ai"` branch with:

```python
        if prediction_mode == "single_ai":
            template = f"""你是百家乐单AI正式预测模型（学习优化版）。你的唯一任务，是基于当前靴历史、五路特征、五路走势和错题上下文，推理并预测下一局是庄还是闲。

【学习优化内容 - 基于深度学习生成】
- 本版本关键优化：{key_changes}
- 发现的模式规律：{pattern_summary}
- 错误模式总结：{error_patterns}
- 核心洞察：{key_insight}
- 置信度阈值建议：{confidence_threshold}

【决策规则】
1. 先阅读五路特征摘要，再核对五路原始点位。
2. 再结合历史结果与错题上下文，判断下一局更偏庄还是更偏闲。
3. 即使信号冲突，也必须选庄或闲。
4. 不允许输出“无法判断”“继续观察”“等待更多数据”。
5. 如果把握不高，只能通过降低 confidence 表达不确定性。

【输出契约】
你可以先内部深度思考，但最终只输出严格 JSON。
不要输出 Markdown，不要输出代码块，不要输出任何额外解释，不要输出 JSON 之外的任何前后缀。
输出必须是一个 JSON 对象，字段如下：
{{"final_prediction":"庄或闲","confidence":0-1,"bet_tier":"保守/标准/激进","summary":"一句话说明为什么偏向这个方向","reasoning_points":["要点1","要点2"],"reasoning_detail":"解释为什么预测下一局是这个方向"}}

【输入数据】
靴号：{{BOOT_NUMBER}}
局号：{{GAME_NUMBER}}
连续失准：{{CONSECUTIVE_ERRORS}}
历史：{{GAME_HISTORY}}
五路特征摘要：{{ROAD_FEATURES}}
五路：{{ROAD_DATA}}
复盘记录：{{MISTAKE_CONTEXT}}"""
            return template
```

- [ ] **Step 3: Run the learned-template test file**

Run:

```bash
python -m pytest backend/tests/test_single_ai_prompt_templates_api.py -q
```

Expected:

```text
all prompt-template API tests pass
```

- [ ] **Step 4: Run the final single-AI regression suite**

Run:

```bash
python -m pytest backend/tests/test_single_ai_analysis.py backend/tests/test_single_ai_prompt_templates_api.py backend/tests/test_analysis_outcome_contract.py backend/tests/test_game_analysis_trigger_flow.py -q
```

Expected:

```text
all selected tests pass
```

- [ ] **Step 5: Commit the learning-template alignment**

```bash
git add backend/app/services/ai_learning_service.py backend/tests/test_single_ai_prompt_templates_api.py
git commit -m "refactor: align learned single-ai prompts with prediction contract"
```

## Task 4: Final Verification And Push

**Files:**
- Modify: `backend/app/services/single_model_service.py`
- Modify: `backend/app/services/ai_learning_service.py`
- Modify: `backend/tests/test_single_ai_analysis.py`
- Modify: `backend/tests/test_single_ai_prompt_templates_api.py`

- [ ] **Step 1: Run the complete targeted regression pack**

Run:

```bash
python -m pytest \
  backend/tests/test_single_ai_analysis.py \
  backend/tests/test_single_ai_prompt_templates_api.py \
  backend/tests/test_analysis_outcome_contract.py \
  backend/tests/test_game_analysis_trigger_flow.py \
  backend/tests/test_api_config_and_prediction_mode_flow.py \
  -q
```

Expected:

```text
all selected tests pass
```

- [ ] **Step 2: Inspect the final diff**

Run:

```bash
git diff --stat HEAD~3..HEAD
```

Expected:

```text
single-ai prompt and test files listed, no unrelated files
```

- [ ] **Step 3: Push the branch**

```bash
git push origin main
```

- [ ] **Step 4: Verify production received the new bundle and backend**

Run:

```bash
python - <<'PY'
import urllib.request
print(urllib.request.urlopen("https://bbbbb-backend.onrender.com/api/system/ping", timeout=20).read().decode())
print("frontend ok" if urllib.request.urlopen("https://bbbbb-frontend.onrender.com", timeout=20).status == 200 else "frontend bad")
PY
```

Expected:

```text
{"ok":true}
frontend ok
```

- [ ] **Step 5: Commit any final deployment-follow-up notes if needed**

```bash
git status -sb
```

Expected:

```text
working tree clean
```
