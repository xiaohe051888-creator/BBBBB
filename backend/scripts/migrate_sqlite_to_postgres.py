import asyncio
import os
import sys


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


async def main() -> None:
    sqlite_url = os.environ["SQLITE_URL"]
    postgres_url = os.environ["POSTGRES_URL"]

    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from sqlalchemy import select

    from app.models.schemas import (
        AIMemory,
        BetRecord,
        GameRecord,
        MistakeBook,
        ModelVersion,
        RoadMap,
        SystemLog,
        SystemState,
    )

    src_engine = create_async_engine(sqlite_url)
    dst_engine = create_async_engine(postgres_url)
    Src = async_sessionmaker(src_engine, expire_on_commit=False)
    Dst = async_sessionmaker(dst_engine, expire_on_commit=False)

    models = (SystemState, GameRecord, BetRecord, SystemLog, MistakeBook, RoadMap, AIMemory, ModelVersion)

    async with Src() as s, Dst() as d:
        for Model in models:
            rows = (await s.execute(select(Model))).scalars().all()
            if not rows:
                continue
            for r in rows:
                data = {c.name: getattr(r, c.name) for c in Model.__table__.columns if c.name != "id"}
                d.add(Model(**data))
            await d.commit()

    await src_engine.dispose()
    await dst_engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

