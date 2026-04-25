import asyncio
from app.core.database import async_session
from sqlalchemy import text

async def check():
    async with async_session() as db:
        res = await db.execute(text("SELECT status FROM system_state LIMIT 1"))
        print("Backend Status:", res.scalar())

asyncio.run(check())
