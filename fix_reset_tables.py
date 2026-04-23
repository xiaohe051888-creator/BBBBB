import re

with open('/workspace/backend/app/services/game/upload.py', 'r') as f:
    content = f.read()

content = content.replace(
    "from app.models.schemas import GameRecord, BetRecord, SystemLog, MistakeBook",
    "from app.models.schemas import GameRecord, BetRecord, SystemLog, MistakeBook, RoadMap, AIMemory"
)

replacement = """    if boot_number is not None:
        # 删除当前靴的游戏记录
        await db.execute(
            delete(GameRecord).where(GameRecord.boot_number == boot_number)
        )
        # 删除当前靴的下注记录
        await db.execute(
            delete(BetRecord).where(BetRecord.boot_number == boot_number)
        )
        # 删除当前靴的错题记录，避免幽灵血迹
        await db.execute(
            delete(MistakeBook).where(MistakeBook.boot_number == boot_number)
        )
        # 删除当前靴的五路图缓存
        await db.execute(
            delete(RoadMap).where(RoadMap.boot_number == boot_number)
        )
        # 删除当前靴的微学习记忆
        await db.execute(
            delete(AIMemory).where(AIMemory.boot_number == boot_number)
        )
        await db.flush()"""

content = re.sub(r'    if boot_number is not None:\n        # 删除当前靴的游戏记录.*?\n        await db.flush\(\)', replacement, content, flags=re.DOTALL)

with open('/workspace/backend/app/services/game/upload.py', 'w') as f:
    f.write(content)

