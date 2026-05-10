# History Backfill And Detail Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自动回补已经被旧逻辑清空的历史展示字段，并对 `推理详情` 做第二轮移动端优先精修。

**Architecture:** 后端新增一个独立的历史回补服务，聚合 `GameRecord / BetRecord / SystemLog` 证据链恢复缺失字段，并通过系统维护接口显式触发；前端保持现有详情结构不变，仅继续优化抽屉阅读体验、移动端节奏和信息对比度。最后通过真实线上回补和页面复测验证效果。

**Tech Stack:** FastAPI, SQLAlchemy, React, TypeScript, Ant Design, pytest, Vitest

---

## File Map

- Create: `backend/app/services/game/history_backfill.py`
  - 承载历史局证据聚合、字段恢复和 dry-run 摘要逻辑
- Modify: `backend/app/api/routes/system.py`
  - 暴露 `POST /api/system/backfill-history` 维护入口
- Create: `backend/tests/test_history_backfill.py`
  - 锁住回补成功、冲突跳过、dry-run 不落库
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`
  - 进行第二轮抽屉与卡片精修
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx`
  - 锁住精修后关键区块仍存在

---

### Task 1: 实现历史回补服务

**Files:**
- Create: `backend/app/services/game/history_backfill.py`
- Create: `backend/tests/test_history_backfill.py`

- [ ] **Step 1: 写失败测试，锁住基于 BetRecord 的历史回补**

```python
def test_backfill_history_from_bet_record():
    async def _run():
        from app.core.database import init_db, async_session
        from app.models.schemas import GameRecord, BetRecord
        from app.services.game.history_backfill import backfill_history_for_boot
        from sqlalchemy import delete, select

        await init_db()
        async with async_session() as db:
            await db.execute(delete(GameRecord).where(GameRecord.boot_number == 88))
            await db.execute(delete(BetRecord).where(BetRecord.boot_number == 88))
            db.add(GameRecord(boot_number=88, game_number=5, result="庄", predict_direction=None, predict_correct=None, profit_loss=0))
            db.add(BetRecord(
                boot_number=88,
                game_number=5,
                direction="庄",
                amount=10,
                status="已结算",
                settlement_amount=19.5,
                profit_loss=9.5,
                balance_after=1009.5,
                prediction_mode="single_ai",
            ))
            await db.commit()

            summary = await backfill_history_for_boot(db, boot_number=88, dry_run=False)
            await db.commit()

            row = (
                await db.execute(
                    select(GameRecord).where(GameRecord.boot_number == 88, GameRecord.game_number == 5)
                )
            ).scalar_one()
            return summary, row

    summary, row = asyncio.run(_run())
    assert summary["updated_games"] == 1
    assert row.predict_direction == "庄"
    assert row.predict_correct is True
    assert float(row.profit_loss) == 9.5
    assert row.settlement_status == "已结算"
```

- [ ] **Step 2: 运行测试，确认先红**

Run: `python -m pytest backend/tests/test_history_backfill.py -q`

Expected: FAIL，提示 `history_backfill` 服务尚不存在。

- [ ] **Step 3: 以最小实现新增回补服务**

```python
async def backfill_history_for_boot(
    db: AsyncSession,
    boot_number: int,
    limit_games: int | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    target_games = await _load_target_games(db, boot_number=boot_number, limit_games=limit_games)
    bets = await _load_bets_by_game(db, boot_number=boot_number)
    logs = await _load_logs_by_game(db, boot_number=boot_number)

    updated = 0
    skipped = 0
    conflicts = 0

    for game in target_games:
        patch, has_conflict = _build_patch(game=game, bet=bets.get(game.game_number), logs=logs.get(game.game_number, []))
        if has_conflict:
            conflicts += 1
            continue
        if not patch:
            skipped += 1
            continue
        if not dry_run:
            _apply_patch(game, patch)
        updated += 1

    return {
        "boot_number": boot_number,
        "scanned_games": len(target_games),
        "updated_games": updated,
        "skipped_games": skipped,
        "conflicts": conflicts,
        "dry_run": dry_run,
    }
```

- [ ] **Step 4: 为日志兜底和 dry-run 再补一个失败测试**

```python
def test_backfill_history_dry_run_from_logs_only():
    async def _run():
        from app.core.database import init_db, async_session
        from app.models.schemas import GameRecord, SystemLog
        from app.services.game.history_backfill import backfill_history_for_boot
        from sqlalchemy import delete, select

        await init_db()
        async with async_session() as db:
            await db.execute(delete(GameRecord).where(GameRecord.boot_number == 89))
            await db.execute(delete(SystemLog).where(SystemLog.boot_number == 89))
            db.add(GameRecord(boot_number=89, game_number=7, result="闲", predict_direction=None, predict_correct=None, profit_loss=0))
            db.add(SystemLog(
                boot_number=89,
                game_number=7,
                event_code="LOG-MDL-001",
                event_type="AI分析",
                event_result="成功",
                description="🧠 AI对第7局推理完成：预测【闲】 (置信度: 55%)",
            ))
            await db.commit()

            summary = await backfill_history_for_boot(db, boot_number=89, dry_run=True)
            row = (
                await db.execute(
                    select(GameRecord).where(GameRecord.boot_number == 89, GameRecord.game_number == 7)
                )
            ).scalar_one()
            return summary, row

    summary, row = asyncio.run(_run())
    assert summary["updated_games"] == 1
    assert summary["dry_run"] is True
    assert row.predict_direction is None
```

- [ ] **Step 5: 运行测试，确认新场景先红**

Run: `python -m pytest backend/tests/test_history_backfill.py -q`

Expected: FAIL，说明日志兜底或 dry-run 行为还没补齐。

- [ ] **Step 6: 补齐日志解析与 dry-run 支持**

```python
PREDICTION_RE = re.compile(r"第(?P<game>\d+)局推理完成：预测【(?P<direction>庄|闲)】")
PROFIT_RE = re.compile(r"盈亏(?P<profit>[+-]?\d+(?:\.\d+)?)")

def _extract_from_logs(logs: list[SystemLog]) -> dict[str, Any]:
    patch: dict[str, Any] = {}
    for log in logs:
        text = log.description or ""
        prediction = PREDICTION_RE.search(text)
        if prediction:
            patch.setdefault("predict_direction", prediction.group("direction"))
        profit = PROFIT_RE.search(text)
        if profit:
            patch.setdefault("profit_loss", float(profit.group("profit")))
    return patch
```

- [ ] **Step 7: 运行测试，确认转绿**

Run: `python -m pytest backend/tests/test_history_backfill.py -q`

Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add backend/app/services/game/history_backfill.py backend/tests/test_history_backfill.py
git commit -m "feat(backend): add history backfill service"
```

---

### Task 2: 暴露维护接口并接入真实调用入口

**Files:**
- Modify: `backend/app/api/routes/system.py`
- Test: `backend/tests/test_history_backfill.py`

- [ ] **Step 1: 写失败测试，锁住回补接口响应**

```python
def test_system_backfill_history_endpoint():
    from fastapi.testclient import TestClient
    from app.api.main import app

    client = TestClient(app)
    response = client.post("/api/system/backfill-history", json={"boot_number": 1, "dry_run": True})
    assert response.status_code == 401
```

- [ ] **Step 2: 运行测试，确认路由尚不存在**

Run: `python -m pytest backend/tests/test_history_backfill.py -q`

Expected: FAIL，说明路由未注册或返回 404。

- [ ] **Step 3: 在系统路由中增加维护入口**

```python
@router.post("/backfill-history")
async def backfill_history(
    boot_number: int | None = None,
    limit_games: int | None = None,
    dry_run: bool = False,
    _: dict = Depends(get_current_user),
):
    from app.services.game.history_backfill import backfill_history_for_boot

    async with async_session() as session:
        effective_boot = int(boot_number or (await get_current_state()).get("boot_number") or 1)
        summary = await backfill_history_for_boot(
            session,
            boot_number=effective_boot,
            limit_games=limit_games,
            dry_run=dry_run,
        )
        if not dry_run:
            await session.commit()
        return {"success": True, **summary}
```

- [ ] **Step 4: 运行测试，确认接口转绿**

Run: `python -m pytest backend/tests/test_history_backfill.py -q`

Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add backend/app/api/routes/system.py backend/tests/test_history_backfill.py
git commit -m "feat(api): expose history backfill endpoint"
```

---

### Task 3: 详情页第二轮精修

**Files:**
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx`

- [ ] **Step 1: 先写失败测试，锁住精修后的关键视觉块仍存在**

```tsx
it('keeps summary and source tags readable after polish', async () => {
  root.render(<AnalysisDetailDrawer open onClose={() => {}} outcome={mockOutcome} />);
  const html = document.body.innerHTML;
  expect(html).toContain('本局建议：庄');
  expect(html).toContain('规则兜底');
  expect(html).toContain('高把握');
  expect(html).toContain('来源说明');
});
```

- [ ] **Step 2: 运行测试，确认先红**

Run: `npm test -- src/components/dashboard/AnalysisDetailDrawer.test.tsx`

Expected: FAIL，说明精修后的关键标签或文案尚未满足。

- [ ] **Step 3: 最小实现第二轮精修**

```tsx
const shellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  maxWidth: 860,
  margin: '0 auto',
  paddingBottom: 24,
};
```

```tsx
<Drawer
  ...
  height="88vh"
  styles={{
    body: {
      padding: 14,
      background: '#f3f6fb',
    },
  }}
>
```

```tsx
<p
  style={{
    margin: '14px 0 10px',
    fontSize: 26,
    lineHeight: 1.25,
    fontWeight: 800,
    color: '#0f172a',
  }}
>
  本局建议：{outcome.direction}
</p>
```

- [ ] **Step 4: 进一步调整技术说明和来源说明弱化样式**

```tsx
<section
  style={{
    ...sectionCardStyle,
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
  }}
>
```

```tsx
<Collapse
  ghost
  items={[
    {
      key: 'diagnostic',
      label: '技术说明',
      children: <p style={{ ...bodyTextStyle, color: '#475569' }}>{outcome.technical_diagnostic.message}</p>,
    },
  ]}
/>
```

- [ ] **Step 5: 运行测试，确认转绿**

Run: `npm test -- src/components/dashboard/AnalysisDetailDrawer.test.tsx`

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/dashboard/AnalysisDetailDrawer.tsx frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx
git commit -m "feat(frontend): polish analysis detail drawer"
```

---

### Task 4: 回归与线上真实复测

**Files:**
- Test: `backend/tests/test_history_backfill.py`
- Test: `frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx`

- [ ] **Step 1: 跑后端目标回归**

Run: `python -m pytest backend/tests/test_history_backfill.py backend/tests/test_upload_reset_current_boot_history_snapshot.py backend/tests/test_state_machine_idempotency.py -q`

Expected: PASS

- [ ] **Step 2: 跑前端测试与构建**

Run: `cd frontend && npm test -- src/components/dashboard/AnalysisDetailDrawer.test.tsx && npm run build`

Expected: PASS

- [ ] **Step 3: 检查诊断**

Check diagnostics for:
- `backend/app/services/game/history_backfill.py`
- `backend/app/api/routes/system.py`
- `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`

Expected: 无明显新增报错

- [ ] **Step 4: 提交并推送**

```bash
git add backend/app/services/game/history_backfill.py backend/app/api/routes/system.py backend/tests/test_history_backfill.py frontend/src/components/dashboard/AnalysisDetailDrawer.tsx frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx docs/superpowers/specs/2026-05-10-history-backfill-and-detail-polish-design.md docs/superpowers/plans/2026-05-10-history-backfill-and-detail-polish-implementation-plan.md
git commit -m "fix: backfill historical records and polish analysis detail"
git push origin main
```

- [ ] **Step 5: 线上执行真实回补**

Run:

```bash
python - <<'PY'
import json, urllib.request
base='https://bbbbb-backend.onrender.com'
login=json.dumps({'username':'1111','password':'1111'}).encode()
req=urllib.request.Request(base+'/api/auth/login', data=login, headers={'Content-Type':'application/json'})
with urllib.request.urlopen(req, timeout=60) as resp:
    token=json.loads(resp.read().decode())['token']
payload=json.dumps({'boot_number':1,'dry_run':False}).encode()
req=urllib.request.Request(base+'/api/system/backfill-history', data=payload, headers={'Content-Type':'application/json','Authorization':f'Bearer {token}'}, method='POST')
with urllib.request.urlopen(req, timeout=120) as resp:
    print(resp.read().decode())
PY
```

Expected: 返回 `success: true` 和回补摘要。

- [ ] **Step 6: 线上页面复测**

Checklist:

- 刷新 `dashboard`
- 确认历史局不再大面积 `预测 - / 正确 - / 盈亏 0.00`
- 打开 `查看详细原因`
- 确认移动端/窄宽度下详情卡片更舒服、更易读
