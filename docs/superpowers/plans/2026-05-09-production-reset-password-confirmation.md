# 生产环境清空数据二次密码确认 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让管理员在生产环境执行“清空演示数据/全量清空”前必须再次输入当前管理员密码，校验通过后才允许清空。

**Architecture:** 保持现有 `/api/admin/maintenance/reset-all` 路由不变，只扩展请求体和生产环境校验逻辑。后端在管理员 JWT 校验通过后，再用 `confirm_password` 对当前管理员 `password_hash` 做 bcrypt 二次校验；前端在管理员页为生产环境增加确认密码弹窗，并把密码透传给该接口。

**Tech Stack:** FastAPI + SQLAlchemy Async + bcrypt（后端），React + TypeScript + Ant Design（前端），pytest + vitest（测试）。

---

## 代码结构定位

**后端**
- 路由：`/workspace/backend/app/api/routes/maintenance.py`
- 路由模型：`/workspace/backend/app/api/routes/schemas.py`
- 管理员模型：`/workspace/backend/app/models/schemas.py`
- 认证与 actor：`/workspace/backend/app/api/routes/utils.py`
- 审计写日志：`/workspace/backend/app/services/game/logging.py`
- 维护接口测试：`/workspace/backend/tests/test_admin_maintenance_api.py`

**前端**
- 管理员页：`/workspace/frontend/src/pages/AdminPage.tsx`
- API 封装：`/workspace/frontend/src/services/api.ts`
- 现有前端测试风格：`/workspace/frontend/src/pages/*.test.tsx`、`/workspace/frontend/src/services/*.test.ts`

---

### Task 1: 后端先写失败测试，锁定生产环境清空规则

**Files:**
- Modify: `backend/tests/test_admin_maintenance_api.py`

- [ ] **Step 1: 写“生产环境不传确认密码返回 400”的失败测试**

在 `AdminMaintenanceApiTest` 中新增：

```python
    def test_reset_all_requires_confirm_password_in_production(self):
        old_env = os.environ.get("ENVIRONMENT")
        try:
            os.environ["ENVIRONMENT"] = "production"
            self._ensure_admin_password("8888")
            client = TestClient(app)
            token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            r = client.post("/api/admin/maintenance/reset-all", headers=headers, json={})
            self.assertEqual(r.status_code, 400)
            self.assertIn("再次输入管理员密码", r.json()["detail"])
        finally:
            if old_env is None:
                os.environ.pop("ENVIRONMENT", None)
            else:
                os.environ["ENVIRONMENT"] = old_env
```

- [ ] **Step 2: 写“生产环境确认密码错误返回 401”的失败测试**

继续新增：

```python
    def test_reset_all_rejects_wrong_confirm_password_in_production(self):
        old_env = os.environ.get("ENVIRONMENT")
        try:
            os.environ["ENVIRONMENT"] = "production"
            self._ensure_admin_password("8888")
            client = TestClient(app)
            token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            r = client.post(
                "/api/admin/maintenance/reset-all",
                headers=headers,
                json={"confirm_password": "wrong"},
            )
            self.assertEqual(r.status_code, 401)
            self.assertIn("确认密码错误", r.json()["detail"])
        finally:
            if old_env is None:
                os.environ.pop("ENVIRONMENT", None)
            else:
                os.environ["ENVIRONMENT"] = old_env
```

- [ ] **Step 3: 写“生产环境确认密码正确可清空”的失败测试**

继续新增：

```python
    def test_reset_all_accepts_confirm_password_in_production(self):
        async def _seed():
            from app.core.database import init_db, async_session
            from app.models.schemas import GameRecord

            await init_db()
            async with async_session() as s:
                s.add(GameRecord(boot_number=777777, game_number=1, result="庄"))
                await s.commit()

        old_env = os.environ.get("ENVIRONMENT")
        try:
            os.environ["ENVIRONMENT"] = "production"
            asyncio.run(_seed())
            self._ensure_admin_password("8888")
            client = TestClient(app)
            token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            r = client.post(
                "/api/admin/maintenance/reset-all",
                headers=headers,
                json={"confirm_password": "8888"},
            )
            self.assertEqual(r.status_code, 200)
            self.assertIn("deleted", r.json())
        finally:
            if old_env is None:
                os.environ.pop("ENVIRONMENT", None)
            else:
                os.environ["ENVIRONMENT"] = old_env
```

- [ ] **Step 4: 单测运行，确认先失败**

Run: `python -m pytest backend/tests/test_admin_maintenance_api.py -q`
Expected: FAIL，错误集中在 `/reset-all` 仍固定返回 `403`

- [ ] **Step 5: 提交测试骨架**

```bash
git add backend/tests/test_admin_maintenance_api.py
git commit -m "test(maintenance): cover production reset password confirmation"
```

---

### Task 2: 后端实现 confirm_password 校验和审计

**Files:**
- Modify: `backend/app/api/routes/schemas.py`
- Modify: `backend/app/api/routes/maintenance.py`

- [ ] **Step 1: 在路由模型中新增 reset-all 请求体**

在 `backend/app/api/routes/schemas.py` 新增：

```python
class MaintenanceResetAllRequest(BaseModel):
    confirm_password: str | None = Field(None, min_length=1, max_length=128)
```

- [ ] **Step 2: 在 maintenance 路由中接收请求体**

把签名从：

```python
@router.post("/reset-all")
async def maintenance_reset_all(_: dict = Depends(get_current_admin)):
```

改成：

```python
@router.post("/reset-all")
async def maintenance_reset_all(
    req: MaintenanceResetAllRequest | None = None,
    actor: dict = Depends(get_current_admin),
):
```

并在文件顶部补充导入：

```python
from app.api.routes.schemas import MaintenanceResetAllRequest
from app.models.schemas import AdminUser
```

- [ ] **Step 3: 实现生产环境下的二次密码校验**

在 `maintenance_reset_all()` 开头替换原来的生产环境 `403`：

```python
    import bcrypt as _bcrypt

    confirm_password = (req.confirm_password if req else None) or ""
    is_production = settings.ENVIRONMENT.lower() == "production"

    if is_production:
        if not confirm_password:
            raise HTTPException(status_code=400, detail="生产环境清空需要再次输入管理员密码确认")

        async with async_session() as session:
            admin_username = (actor or {}).get("username") or "admin"
            admin = (
                await session.execute(
                    select(AdminUser).where(AdminUser.username == admin_username)
                )
            ).scalar_one_or_none()

            if not admin:
                raise HTTPException(status_code=401, detail="管理员账号不存在")

            try:
                valid = _bcrypt.checkpw(
                    confirm_password.encode("utf-8"),
                    admin.password_hash.encode("utf-8"),
                )
            except Exception:
                valid = False

            if not valid:
                await write_game_log(
                    session=session,
                    boot_number=0,
                    game_number=0,
                    event_code="ADMIN-RESET-ALL",
                    event_type="系统维护",
                    event_result="REJECTED",
                    description="生产环境清空被拒绝：确认密码错误",
                    category="系统维护",
                    priority="P1",
                    source_module="maintenance",
                )
                await session.commit()
                raise HTTPException(status_code=401, detail="确认密码错误")
```

- [ ] **Step 4: 为缺少确认密码和成功清空也补审计日志**

在缺少确认密码分支前后补充：

```python
        if not confirm_password:
            async with async_session() as session:
                await write_game_log(
                    session=session,
                    boot_number=0,
                    game_number=0,
                    event_code="ADMIN-RESET-ALL",
                    event_type="系统维护",
                    event_result="REJECTED",
                    description="生产环境清空被拒绝：未提供确认密码",
                    category="系统维护",
                    priority="P1",
                    source_module="maintenance",
                )
                await session.commit()
            raise HTTPException(status_code=400, detail="生产环境清空需要再次输入管理员密码确认")
```

在真正清空完成、`await session.commit()` 后再写成功日志：

```python
    async with async_session() as session:
        await write_game_log(
            session=session,
            boot_number=1,
            game_number=0,
            event_code="ADMIN-RESET-ALL",
            event_type="系统维护",
            event_result="OK",
            description="生产环境全量清空执行成功" if is_production else "非生产环境全量清空执行成功",
            category="系统维护",
            priority="P1",
            source_module="maintenance",
        )
        await session.commit()
```

- [ ] **Step 5: 跑维护接口测试确认通过**

Run: `python -m pytest backend/tests/test_admin_maintenance_api.py -q`
Expected: PASS

- [ ] **Step 6: 跑后端全量测试确认未回归**

Run: `python -m pytest backend/tests -q`
Expected: PASS

- [ ] **Step 7: 提交后端实现**

```bash
git add backend/app/api/routes/schemas.py backend/app/api/routes/maintenance.py backend/tests/test_admin_maintenance_api.py
git commit -m "feat(maintenance): require password confirmation for production reset"
```

---

### Task 3: 前端增加生产环境密码确认弹窗

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/pages/AdminPage.tsx`

- [ ] **Step 1: 扩展 reset-all API 方法支持 confirm_password**

把 `frontend/src/services/api.ts` 中：

```ts
export const adminMaintenanceResetAll = async () => {
  return api.post<AdminMaintenanceResetAllResponse>('/admin/maintenance/reset-all');
};
```

改成：

```ts
export const adminMaintenanceResetAll = async (payload?: { confirm_password?: string }) => {
  return api.post<AdminMaintenanceResetAllResponse>('/admin/maintenance/reset-all', payload || {});
};
```

- [ ] **Step 2: 在 AdminPage 中增加确认弹窗状态**

在状态区新增：

```ts
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetConfirmSubmitting, setResetConfirmSubmitting] = useState(false);
```

并增加环境判断：

```ts
  const isProduction = typeof window !== 'undefined' && window.location.hostname.includes('onrender.com');
```

- [ ] **Step 3: 重写 resetAllData 逻辑**

把现有 `modal.confirm(...)` 的一把梭逻辑拆成两段：

```ts
  const doResetAll = useCallback(async (confirmPassword?: string) => {
    setResetConfirmSubmitting(true);
    try {
      const res = await api.adminMaintenanceResetAll(
        confirmPassword ? { confirm_password: confirmPassword } : {},
      );
      const d = res.data.deleted || {};
      message.success(`已清空：局记录 ${d.game_records || 0}、下注记录 ${d.bet_records || 0}、运行记录 ${d.system_logs || 0}`);
      setDbRecords([]);
      setDbPage(1);
      queryClient.invalidateQueries({ queryKey: ['systemState'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      loadMaintenanceStats();
      navigate('/dashboard');
    } catch (err: any) {
      message.error(err.response?.data?.detail || err.message || '清空失败');
    } finally {
      setResetConfirmSubmitting(false);
    }
  }, [loadMaintenanceStats, message, navigate, queryClient]);
```

然后把 `resetAllData` 改成：

```ts
  const resetAllData = useCallback(() => {
    if (isProduction) {
      setResetConfirmPassword('');
      setResetConfirmVisible(true);
      return;
    }
    modal.confirm({
      title: formatDangerZoneLabel('resetAllTitle'),
      content: '将清空所有演示用的数据，清空后不可恢复。',
      okText: '确认清空',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await doResetAll();
      },
    });
  }, [doResetAll, isProduction, modal]);
```

- [ ] **Step 4: 在页面底部新增密码确认弹窗**

在 `AdminPage` 返回 JSX 末尾补充：

```tsx
      <Modal
        title="生产环境二次确认"
        open={resetConfirmVisible}
        onCancel={() => {
          setResetConfirmVisible(false);
          setResetConfirmPassword('');
        }}
        onOk={async () => {
          await doResetAll(resetConfirmPassword);
          setResetConfirmVisible(false);
          setResetConfirmPassword('');
        }}
        okText="验证并清空"
        cancelText="取消"
        okButtonProps={{ danger: true, disabled: !resetConfirmPassword, loading: resetConfirmSubmitting }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>你正在清空生产环境数据，此操作不可恢复，请再次输入当前管理员密码确认。</div>
          <Input.Password
            placeholder="请输入当前管理员密码"
            value={resetConfirmPassword}
            onChange={(e) => setResetConfirmPassword(e.target.value)}
          />
        </Space>
      </Modal>
```

- [ ] **Step 5: 跑前端测试与构建**

Run: `npm test --silent`
Expected: PASS

Run: `npm run build --silent`
Expected: PASS

- [ ] **Step 6: 提交前端实现**

```bash
git add frontend/src/services/api.ts frontend/src/pages/AdminPage.tsx
git commit -m "feat(frontend): add production password confirmation for reset"
```

---

### Task 4: 回归检查与发布

**Files:**
- Modify: `docs/superpowers/specs/2026-05-09-user-auth-admin-portal-design.md`（如实现细节有偏差则回填）

- [ ] **Step 1: 跑后端全量回归**

Run: `python -m pytest backend/tests -q`
Expected: PASS

- [ ] **Step 2: 跑前端全量回归**

Run: `cd frontend && npm test --silent`
Expected: PASS

- [ ] **Step 3: 跑前端构建**

Run: `cd frontend && npm run build --silent`
Expected: PASS

- [ ] **Step 4: 核对实现与规格一致**

人工检查以下 5 点：

```text
1. 非生产环境仍可直接清空
2. 生产环境必须输入 confirm_password
3. confirm_password 错误返回 401
4. 成功和拒绝都写入 ADMIN-RESET-ALL 审计日志
5. 前端提示文案明确说明“生产环境不可恢复”
```

- [ ] **Step 5: 推送发布**

```bash
git push origin main
```

Expected: 远端 `main` 更新，触发 Render 自动部署

---

## 自检

- 规格覆盖：已覆盖前端交互、后端校验、审计、测试四部分要求。
- 占位检查：计划中未使用 TBD/TODO/“自行处理”等空泛占位描述。
- 一致性检查：统一使用 `confirm_password` 作为前后端字段名，统一使用 `ADMIN-RESET-ALL` 作为审计事件码。
