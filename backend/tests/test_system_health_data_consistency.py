import asyncio
import os
import sys
import unittest
from datetime import datetime

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class SystemHealthDataConsistencyTest(unittest.TestCase):
    def test_health_data_consistency_flags_pending_bets_and_high_priority_errors(self):
        async def _seed():
            import bcrypt as _bcrypt
            from app.core.database import init_db, async_session
            from app.models.schemas import BetRecord, SystemLog, SystemState, AdminUser
            from sqlalchemy import select

            await init_db()

            async with async_session() as s:
                boot = 999999
                await s.execute(BetRecord.__table__.delete().where(BetRecord.boot_number == boot))
                await s.execute(SystemLog.__table__.delete().where(SystemLog.boot_number == boot))

                state = (
                    (await s.execute(select(SystemState).where(SystemState.singleton_key == 1).limit(1)))
                    .scalars()
                    .first()
                )
                if not state:
                    s.add(SystemState(singleton_key=1))

                admin = (await s.execute(select(AdminUser).where(AdminUser.username == "admin"))).scalar_one_or_none()
                if not admin:
                    admin = AdminUser(username="admin", password_hash="", must_change_password=True)
                    s.add(admin)
                admin.password_hash = _bcrypt.hashpw(b"8888", _bcrypt.gensalt()).decode("utf-8")
                admin.login_attempts = 0
                admin.locked_until = None

                now = datetime.now()
                for i in range(1, 7):
                    s.add(
                        BetRecord(
                            boot_number=boot,
                            game_number=i,
                            bet_seq=1,
                            bet_direction="庄",
                            bet_amount=10.0,
                            bet_tier="标准",
                            status="待开奖",
                            balance_before=1000.0,
                            balance_after=990.0,
                            bet_time=now,
                        )
                    )

                for i in range(3):
                    s.add(
                        SystemLog(
                            boot_number=boot,
                            game_number=1,
                            event_code=f"TEST-ERR-{i}",
                            event_type="测试",
                            event_result="失败",
                            description="测试高优先级错误",
                            category="测试",
                            priority="P1",
                            source_module="tests",
                            log_time=now,
                        )
                    )

                await s.commit()

        asyncio.run(_seed())

        from app.api.main import app

        client = TestClient(app)

        token = client.post("/api/admin/login", json={"password": "8888"}).json()["token"]
        r = client.get("/api/system/health", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r.status_code, 200)
        issues = (r.json().get("details", {}).get("data_consistency", {}) or {}).get("issues") or []
        joined = " ".join(issues)
        self.assertIn("未结算下注", joined)
        self.assertIn("高优先级错误", joined)


if __name__ == "__main__":
    unittest.main()
