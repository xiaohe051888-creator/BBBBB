# Analysis Detail Readability And History Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 提升 `推理详情` 在移动端和低对比场景下的可读性，并修复 `reset_current_boot` 后历史开奖记录的 `预测 / 正确 / 盈亏` 被清空的问题。

**Architecture:** 前端在保留现有 `AnalysisDetailDrawer` 入口与交互的前提下，把内容重构成“结论优先、分区阅读、移动端单列”的高可读性布局；后端在重置当前靴前抓取历史展示快照，重写开奖记录后按局号恢复已结算历史字段，避免删除 `BetRecord` 后让 `GameRecord` 展示退化成占位值。

**Tech Stack:** React, TypeScript, Ant Design, Vitest, FastAPI, SQLAlchemy, pytest

---

## File Map

- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`
  - 将当前连续排版改成高对比度分区卡片布局，优先兼顾手机端
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx`
  - 锁住新的阅读顺序和关键分区存在
- Modify: `backend/app/services/game/upload.py`
  - 在 `reset_current_boot` 中抓取并恢复历史展示快照
- Create: `backend/tests/test_upload_reset_current_boot_history_snapshot.py`
  - 锁住重置后历史 `predict_direction / predict_correct / profit_loss` 不丢失

---

### Task 1: 重构详情抽屉可读性

**Files:**
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx`

- [ ] **Step 1: 先写失败测试，锁住新的阅读顺序和分区**

```tsx
it('renders readable sections in the expected order', async () => {
  root.render(
    <AnalysisDetailDrawer
      open
      onClose={() => {}}
      outcome={mockOutcome}
    />
  );

  const html = document.body.innerHTML;

  expect(html.indexOf('本局结论')).toBeGreaterThan(-1);
  expect(html.indexOf('最终为什么押这个方向')).toBeGreaterThan(html.indexOf('本局结论'));
  expect(html.indexOf('五条路怎么看')).toBeGreaterThan(html.indexOf('最终为什么押这个方向'));
  expect(html.indexOf('来源说明')).toBeGreaterThan(html.indexOf('五条路怎么看'));
  expect(html).toContain('规则兜底');
  expect(html).toContain('55%');
});
```

- [ ] **Step 2: 运行测试，确认先红**

Run: `npm test -- src/components/dashboard/AnalysisDetailDrawer.test.tsx`

Expected: FAIL，说明当前断言顺序或新分区结构尚未满足。

- [ ] **Step 3: 以最小改动重构 `AnalysisDetailDrawer` 布局**

```tsx
const cardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: '1px solid #d9d9d9',
  background: '#ffffff',
  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.06)',
};

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
  lineHeight: 1.35,
  fontWeight: 700,
  color: '#111827',
};

const bodyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.85,
  color: '#1f2937',
};
```

```tsx
<Drawer
  open={open}
  onClose={onClose}
  title="推理详情"
  placement="bottom"
  size="large"
  destroyOnClose
  styles={{
    body: {
      padding: 16,
      background: '#f5f7fb',
    },
  }}
>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 960, margin: '0 auto' }}>
    <section style={cardStyle}>
      <h3 style={headingStyle}>本局结论</h3>
      ...
    </section>

    <section style={cardStyle}>
      <h3 style={headingStyle}>最终为什么押这个方向</h3>
      <p style={bodyStyle}>{outcome.final_reason}</p>
    </section>

    <section style={cardStyle}>
      <h3 style={headingStyle}>五条路怎么看</h3>
      ...
    </section>
  </div>
</Drawer>
```

- [ ] **Step 4: 强化五条路卡片的可扫读结构**

```tsx
<article
  key={key}
  style={{
    padding: 14,
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    background: '#fbfdff',
  }}
>
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{ROAD_LABELS[key]}</h4>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Tag color={explanation?.tendency === '庄' ? 'red' : explanation?.tendency === '闲' ? 'blue' : 'default'}>
        {explanation?.tendency || '中性'}
      </Tag>
      <Tag color="processing">{explanation?.support_level || '弱'}支持</Tag>
    </div>
  </div>
  <p style={{ margin: '10px 0 6px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
    {explanation?.trend_label || '当前暂无这条路的额外解释。'}
  </p>
  <p style={bodyStyle}>
    {explanation?.plain_summary || '系统暂时没有拿到这条路的详细说明。'}
  </p>
</article>
```

- [ ] **Step 5: 运行测试，确认转绿**

Run: `npm test -- src/components/dashboard/AnalysisDetailDrawer.test.tsx`

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add frontend/src/components/dashboard/AnalysisDetailDrawer.tsx frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx
git commit -m "feat(frontend): improve analysis detail readability"
```

---

### Task 2: 保留 reset_current_boot 后的历史展示字段

**Files:**
- Modify: `backend/app/services/game/upload.py`
- Create: `backend/tests/test_upload_reset_current_boot_history_snapshot.py`

- [ ] **Step 1: 先写失败测试，锁住历史展示字段恢复**

```python
def test_reset_current_boot_preserves_settled_history_fields():
    async def _run():
        from app.core.database import init_db, async_session
        from app.models.schemas import GameRecord
        from app.services.game.session import clear_session, get_session
        from app.services.game.upload import upload_games
        from sqlalchemy import select

        await init_db()
        clear_session()
        sess = get_session()
        sess.boot_number = 321
        sess.status = "等待开奖"
        sess.next_game_number = 4

        async with async_session() as db:
            db.add(GameRecord(
                boot_number=321,
                game_number=1,
                result="庄",
                predict_direction="庄",
                predict_correct=True,
                settlement_status="已结算",
                profit_loss=9.5,
                balance_after=1009.5,
            ))
            db.add(GameRecord(
                boot_number=321,
                game_number=2,
                result="闲",
                predict_direction="庄",
                predict_correct=False,
                settlement_status="已结算",
                profit_loss=-10,
                balance_after=999.5,
            ))
            await db.commit()

            res = await upload_games(
                db=db,
                games=[
                    {"game_number": 1, "result": "庄"},
                    {"game_number": 2, "result": "闲"},
                    {"game_number": 3, "result": "庄"},
                ],
                mode="reset_current_boot",
                balance_mode="keep",
                run_deep_learning=False,
            )
            await db.commit()

            rows = (
                await db.execute(
                    select(GameRecord)
                    .where(GameRecord.boot_number == res["boot_number"])
                    .order_by(GameRecord.game_number.asc())
                )
            ).scalars().all()

            return res, rows

    res, rows = asyncio.run(_run())
    assert res["success"] is True
    assert rows[0].predict_direction == "庄"
    assert rows[0].predict_correct is True
    assert float(rows[0].profit_loss) == 9.5
    assert rows[1].predict_correct is False
    assert float(rows[1].profit_loss) == -10.0
    assert rows[2].predict_direction is None
```

- [ ] **Step 2: 运行测试，确认先红**

Run: `python -m pytest backend/tests/test_upload_reset_current_boot_history_snapshot.py -q`

Expected: FAIL，说明历史字段在重置后仍然丢失。

- [ ] **Step 3: 在上传模块中添加快照提取函数**

```python
async def _capture_game_history_snapshot(db: AsyncSession, boot_number: int) -> dict[int, dict[str, Any]]:
    result = await db.execute(
        select(GameRecord).where(GameRecord.boot_number == boot_number)
    )
    records = result.scalars().all()
    snapshot: dict[int, dict[str, Any]] = {}
    for record in records:
        snapshot[record.game_number] = {
            "prediction_mode": record.prediction_mode,
            "predict_direction": record.predict_direction,
            "predict_correct": record.predict_correct,
            "settlement_status": record.settlement_status,
            "profit_loss": record.profit_loss,
            "balance_after": record.balance_after,
        }
    return snapshot
```

- [ ] **Step 4: 在重写开奖记录后恢复快照**

```python
def _restore_game_history_snapshot(record: GameRecord, snapshot: dict[str, Any] | None) -> None:
    if not snapshot:
        return
    record.prediction_mode = snapshot.get("prediction_mode")
    record.predict_direction = snapshot.get("predict_direction")
    record.predict_correct = snapshot.get("predict_correct")
    record.settlement_status = snapshot.get("settlement_status")
    record.profit_loss = snapshot.get("profit_loss")
    record.balance_after = snapshot.get("balance_after")
```

```python
history_snapshot: dict[int, dict[str, Any]] = {}
if effective_mode == "reset_current_boot" and boot_number > 0:
    history_snapshot = await _capture_game_history_snapshot(db, boot_number)
```

```python
record = GameRecord(
    boot_number=boot_number,
    game_number=game_number,
    result=result_val,
    result_time=datetime.now(),
)
_restore_game_history_snapshot(record, history_snapshot.get(game_number))
db.add(record)
```

- [ ] **Step 5: 运行测试，确认转绿**

Run: `python -m pytest backend/tests/test_upload_reset_current_boot_history_snapshot.py -q`

Expected: PASS

- [ ] **Step 6: 运行相关回归**

Run: `python -m pytest backend/tests/test_state_machine_idempotency.py backend/tests/test_e2e_upload_analysis_bet_reveal.py backend/tests/test_upload_reset_current_boot_history_snapshot.py -q`

Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add backend/app/services/game/upload.py backend/tests/test_upload_reset_current_boot_history_snapshot.py
git commit -m "fix(backend): preserve history on boot reset"
```

---

### Task 3: 联调与真实复测

**Files:**
- Modify: `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`
- Modify: `backend/app/services/game/upload.py`
- Test: `frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx`
- Test: `backend/tests/test_upload_reset_current_boot_history_snapshot.py`

- [ ] **Step 1: 跑前端测试与构建**

Run: `cd frontend && npm test -- src/components/dashboard/AnalysisDetailDrawer.test.tsx && npm run build`

Expected: PASS，前端构建成功。

- [ ] **Step 2: 跑后端目标测试**

Run: `python -m pytest backend/tests/test_upload_reset_current_boot_history_snapshot.py backend/tests/test_state_machine_idempotency.py -q`

Expected: PASS

- [ ] **Step 3: 检查最近改动文件诊断**

Run diagnostics for:
- `frontend/src/components/dashboard/AnalysisDetailDrawer.tsx`
- `backend/app/services/game/upload.py`

Expected: 无新增易见报错；若有，先修再继续。

- [ ] **Step 4: 线上手工复测详情可读性**

Checklist:

- 用真实账号打开 `dashboard`
- 点击 `查看详细原因`
- 在窄窗口下确认“本局结论 / 最终为什么押这个方向 / 五条路怎么看 / 来源说明”分区清晰
- 确认正文不再是大段低对比灰字

- [ ] **Step 5: 线上手工复测 reset 后历史展示**

Checklist:

- 执行一次 `reset_current_boot`
- 刷新首页开奖记录
- 确认历史局 `预测 / 正确 / 盈亏` 未被错误重置为 `- / 0.00`

- [ ] **Step 6: 最终提交**

```bash
git add frontend/src/components/dashboard/AnalysisDetailDrawer.tsx frontend/src/components/dashboard/AnalysisDetailDrawer.test.tsx backend/app/services/game/upload.py backend/tests/test_upload_reset_current_boot_history_snapshot.py docs/superpowers/specs/2026-05-10-analysis-detail-readability-and-history-reset-design.md docs/superpowers/plans/2026-05-10-analysis-detail-readability-and-history-reset-implementation-plan.md
git commit -m "fix: improve analysis detail readability and preserve reset history"
```
