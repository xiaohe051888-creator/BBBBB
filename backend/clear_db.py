import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import async_session
from app.models.schemas import SystemState

async def clear_all():
    async with async_session() as db:
        await db.execute(text("DELETE FROM bet_records"))
        await db.execute(text("DELETE FROM game_records"))
        await db.execute(text("DELETE FROM system_logs"))
        await db.execute(text("DELETE FROM mistake_book"))
        await db.execute(text("DELETE FROM system_state"))
        # 补齐遗漏的两张表，防止产生无头关联脏数据
        await db.execute(text("DELETE FROM ai_memories"))
        await db.execute(text("DELETE FROM road_maps"))
        
        new_state = SystemState(
            id=1,
            boot_number=1,
            game_number=0,
            status="等待开奖",
            balance=10000.0
        )
        db.add(new_state)
        await db.commit()
        print("✅ 数据库清理并重置完成！")

if __name__ == "__main__":
    asyncio.run(clear_all())
