"""
FastAPI 主应用 - 百家乐分析预测系统（手动模式）
路由拆分版本 - 统一入口
"""
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import List

import logging

logger = logging.getLogger(__name__)

# ========== 加载环境变量（支持直接启动uvicorn时也能读取.env） ==========
from dotenv import load_dotenv
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path, override=True)
    logger.info(f"✅ [api/main.py] 已加载环境变量: {env_path}")
else:
    logger.warning(f"⚠️  [api/main.py] 环境变量文件不存在: {env_path}")

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy import select, desc

from app.core.config import settings
from app.core.database import init_db, async_session
from app.models.schemas import AdminUser, SystemLog, SystemState, BetRecord, MistakeBook

# ============ 导入路由模块 ============
from app.api.routes import game, bet, logs, stats, auth, analysis, websocket
from app.api.routes import system as system_routes
from app.api.routes.utils import get_current_user


# ============ 全局状态 ============
ws_clients: List = []  # WebSocket客户端列表


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    os.makedirs("./data", exist_ok=True)
    await init_db()
    
    # 初始化默认管理员
    async with async_session() as session:
        stmt = select(AdminUser).where(AdminUser.username == "admin")
        result = await session.execute(stmt)
        admin = result.scalar_one_or_none()
        if not admin:
            import bcrypt as _bcrypt
            password_bytes = settings.DEFAULT_ADMIN_PASSWORD.encode('utf-8')
            hashed = _bcrypt.hashpw(password_bytes, _bcrypt.gensalt()).decode('utf-8')
            admin = AdminUser(
                username="admin",
                password_hash=hashed,
                must_change_password=True,
            )
            session.add(admin)
            await session.commit()
            
        # 同步持久化状态到内存 Session
        from app.services.game.session import get_session
        from app.models.schemas import SystemState
        stmt_state = select(SystemState).order_by(SystemState.id.desc()).limit(1)
        res_state = await session.execute(stmt_state)
        db_state = res_state.scalar_one_or_none()
        
        mem_sess = get_session()
        if db_state:
            mem_sess.prediction_mode = db_state.prediction_mode or "ai"
            mem_sess.balance = db_state.balance
            mem_sess.boot_number = db_state.boot_number
            mem_sess.next_game_number = db_state.game_number + 1

    # 注入广播函数到手动游戏服务
    from app.services.manual_game_service import set_broadcast_func
    set_broadcast_func(broadcast_update)
    
    # 恢复内存状态（从数据库）
    from app.services.manual_game_service import sync_balance_from_db
    async with async_session() as session:
        await sync_balance_from_db(session)
    
    logger.info(f"✅ {settings.APP_NAME} v{settings.APP_VERSION} 启动成功（全托管模式）")
    logger.info(f"   访问地址: http://localhost:{settings.PORT}")

    yield

    logger.info("系统已关闭")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS配置
def _parse_cors_origins() -> List[str]:
    """解析CORS允许的来源列表"""
    origins_str = settings.CORS_ORIGINS.strip()
    if origins_str == "*":
        return ["*"]
    return [o.strip() for o in origins_str.split(",") if o.strip()] or ["http://localhost:5173", "http://127.0.0.1:5173"]

_cors_origins = _parse_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ============ 前端静态文件托管（Docker/生产模式） ============
_static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(_static_dir) and os.listdir(_static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="static-assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws") or full_path.startswith("assets/"):
            raise HTTPException(404, f"路由不存在: /{full_path}")
        index_path = os.path.join(_static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        raise HTTPException(404, "前端未构建，请先运行 npm run build")

    logger.info(f"   📦 前端静态文件已挂载: {_static_dir}")


# ============ 注册路由 ============

# 系统状态路由
app.include_router(system_routes.router)

# 游戏路由
app.include_router(game.router)

# 下注路由
app.include_router(bet.router)

# 日志路由
app.include_router(logs.router)

# 统计和走势图路由
app.include_router(stats.router)

# AI分析路由
app.include_router(analysis.router)


# ============ 管理员路由（需要合并的） ============

from app.api.routes.auth import router as auth_router
app.include_router(auth_router)


# --- 管理员：查看数据库记录 ---
from app.models.schemas import GameRecord

@app.get("/api/admin/database-records")
async def get_database_records(
    table_name: str = Query(..., pattern="^(game_records|bet_records|system_logs|mistake_book)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    # _: dict = Depends(get_current_user),
):
    """查看数据库记录（需认证）"""
    table_map = {
        "game_records": GameRecord,
        "bet_records": BetRecord,
        "system_logs": SystemLog,
        "mistake_book": MistakeBook,
    }
    
    model = table_map[table_name]
    
    async with async_session() as session:
        query = select(model).order_by(desc(model.id)).offset((page - 1) * page_size).limit(page_size)
        result = await session.execute(query)
        records = result.scalars().all()
        
        data = []
        for r in records:
            row = {}
            for column in r.__table__.columns:
                val = getattr(r, column.name)
                if hasattr(val, "isoformat"):
                    val = val.isoformat()
                row[column.name] = val
            data.append(row)
        
        return {"table": table_name, "data": data, "page": page, "page_size": page_size}


# ============ WebSocket路由 ============
from app.api.routes.websocket import router as ws_router, broadcast_update
app.include_router(ws_router)

# 将ws_clients暴露给其他模块
app.state.ws_clients = ws_clients


# ============ 导出广播函数（供其他模块使用） ============
def get_broadcast_func():
    """获取广播函数"""
    return broadcast_update
