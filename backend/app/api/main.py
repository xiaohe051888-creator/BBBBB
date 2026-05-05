"""
FastAPI 主应用 - 百家乐分析预测系统
路由拆分版本 - 统一入口
"""
import os
from contextlib import asynccontextmanager
from typing import List

import logging
from logging.handlers import RotatingFileHandler

# ========== 配置全局滚动日志 ==========
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

# 创建一个 RotatingFileHandler: 最大 10MB, 最多保留 5 个备份
file_handler = RotatingFileHandler(
    filename=os.path.join(LOG_DIR, "backend_app.log"),
    maxBytes=10 * 1024 * 1024,
    backupCount=5,
    encoding="utf-8"
)
console_handler = logging.StreamHandler()
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

# 清除默认的 handlers 并设置新的
logging.basicConfig(level=logging.INFO, handlers=[file_handler, console_handler], force=True)
logger = logging.getLogger(__name__)

# ========== 加载环境变量（支持直接启动uvicorn时也能读取.env） ==========
from dotenv import load_dotenv
from app.core.env_migration import get_env_paths, merge_legacy_env, ensure_env_key

env_path, legacy_path = get_env_paths()
merge_info = merge_legacy_env(legacy_path, env_path)
if os.path.exists(env_path):
    load_dotenv(env_path, override=True)
    logger.info(f"✅ [api/main.py] 已加载环境变量: {env_path}")
else:
    logger.warning(f"⚠️  [api/main.py] 环境变量文件不存在: {env_path}")

if merge_info.get("migrated"):
    logger.warning("⚠️  [api/main.py] 检测到历史错误位置的.env，已合并到正确位置（未输出密钥内容）")

_env = (os.getenv("ENVIRONMENT") or "development").lower()
if _env != "production":
    if ensure_env_key(env_path, "JWT_SECRET_KEY"):
        logger.warning("⚠️  [api/main.py] JWT_SECRET_KEY 未配置，已自动生成并写入.env（未输出密钥内容）")

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import select, desc

from app.core.config import settings
from app.core.database import init_db, async_session, close_db
from app.models.schemas import AdminUser, SystemLog, BetRecord, MistakeBook

# ============ 导入路由模块 ============
from app.api.routes import game, bet, logs, stats, analysis, maintenance
from app.api.routes import system as system_routes
from app.api.routes.utils import is_secret_configured


# ============ 全局状态 ============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    os.makedirs(os.path.join(os.path.dirname(env_path), "data"), exist_ok=True)
    from app.core.security import validate_production_security
    validate_production_security()
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
        stmt_state = select(SystemState).where(SystemState.singleton_key == 1).limit(1)
        res_state = await session.execute(stmt_state)
        db_state = res_state.scalar_one_or_none()
        
        from app.services.game.session import get_session_lock
        lock = get_session_lock()
        async with lock:
            mem_sess = get_session()
            if db_state:
                mem_sess.prediction_mode = db_state.prediction_mode or "rule"
                mem_sess.balance = db_state.balance
                mem_sess.boot_number = db_state.boot_number
                mem_sess.next_game_number = db_state.game_number + 1

    async with async_session() as session:
        stmt_state = select(SystemState).where(SystemState.singleton_key == 1)
        res_state = await session.execute(stmt_state)
        state = res_state.scalar_one_or_none()
        current_mode = getattr(state, "prediction_mode", None) or "rule"

        if current_mode == "ai":
            ok = is_secret_configured(settings.OPENAI_API_KEY) and is_secret_configured(settings.ANTHROPIC_API_KEY) and is_secret_configured(settings.GEMINI_API_KEY)
            if not ok:
                current_mode = "rule"
        elif current_mode == "single_ai":
            ok = is_secret_configured(getattr(settings, "SINGLE_AI_API_KEY", ""))
            if not ok:
                current_mode = "rule"

        if state and state.prediction_mode != current_mode:
            state.prediction_mode = current_mode
            await session.commit()

        from app.services.game.session import get_session_lock
        lock = get_session_lock()
        async with lock:
            mem_sess = get_session()
            mem_sess.prediction_mode = current_mode

    # 注入广播函数到游戏服务
    from app.services.game import set_broadcast_func
    set_broadcast_func(broadcast_update)
    
    # 恢复内存状态（从数据库）
    from app.services.game import sync_balance_from_db
    async with async_session() as session:
        await sync_balance_from_db(session)
        from app.services.game.recovery import recover_on_startup
        await recover_on_startup(session)

    if settings.WATCHDOG_ENABLED:
        from app.services.game.watchdog import Watchdog
        from app.core.async_utils import spawn_task
        wd = Watchdog(
            interval_seconds=settings.WATCHDOG_INTERVAL_SECONDS,
            repair_cooldown_seconds=settings.WATCHDOG_REPAIR_COOLDOWN_SECONDS,
            running_task_threshold=settings.WATCHDOG_RUNNING_TASK_THRESHOLD,
            p1_error_window_seconds=settings.WATCHDOG_P1_ERROR_WINDOW_SECONDS,
            p1_error_threshold=settings.WATCHDOG_P1_ERROR_THRESHOLD,
        )
        spawn_task(wd.run_forever(), name="watchdog")
    
    logger.info(f"✅ {settings.APP_NAME} v{settings.APP_VERSION} 启动成功（全托管模式）")
    logger.info(f"   访问地址: http://localhost:{settings.PORT}")

    yield

    from app.core.async_utils import cancel_spawned_tasks
    await cancel_spawned_tasks()

    await close_db()
    logger.info("系统已关闭")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# ============ 全局异常处理器 (Global Exception Handler) ============
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    兜底捕获所有未被处理的 Python 异常 (500 错误)。
    防止后端直接吐出带有堆栈信息的 HTML 页面导致前端 axios 无法解析，
    而是返回统一的 JSON 结构，并确保异常被记录到 RotatingFileHandler。
    """
    logger.error(f"【严重系统异常】访问 {request.method} {request.url.path} 时发生崩溃:", exc_info=exc)
    
    # 避免跨域拦截（当 500 发生时，FastAPI 默认的 HTML 响应可能不带 CORS 头）
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal Server Error",
            "detail": str(exc) if settings.DEBUG else "系统内部发生错误，请查看后台日志",
            "path": request.url.path
        }
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
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ============ 前端静态文件托管（Docker/生产模式） ============
# 指向 backend/static
_static_dir = os.path.join(os.path.dirname(__file__), "..", "..", "static")

# 只有目录确实存在才挂载 assets，避免启动报错
# 必须先挂载静态目录，才能让 /assets 的请求被它优先处理，而不是被下面的通配符拦截
if os.path.isdir(_static_dir) and os.path.isdir(os.path.join(_static_dir, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="static-assets")
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

# 系统维护路由（管理员）
app.include_router(maintenance.router)


# ============ 管理员路由（需要合并的） ============

from app.api.routes.auth import router as auth_router
app.include_router(auth_router)

if settings.E2E_TESTING and settings.ENVIRONMENT != "production":
    from app.api.routes.e2e_testing import router as e2e_testing_router
    app.include_router(e2e_testing_router)


# --- 管理员：查看数据库记录 ---
from fastapi import Depends
from app.api.routes.utils import get_current_user
from app.models.schemas import GameRecord

@app.get("/api/admin/database-records")
async def get_database_records(
    table_name: str = Query(..., pattern="^(game_records|bet_records|system_logs|mistake_book)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _: dict = Depends(get_current_user),
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
                if column.name == "prediction_mode" and not val:
                    val = "rule"
                row[column.name] = val
            data.append(row)
        
        return {"table": table_name, "data": data, "page": page, "page_size": page_size}


# ============ WebSocket路由 ============
from app.api.routes.websocket import router as ws_router, broadcast_update, ws_clients as route_ws_clients
app.include_router(ws_router)

# 将ws_clients暴露给其他模块
app.state.ws_clients = route_ws_clients


# ============ 导出广播函数（供其他模块使用） ============
def get_broadcast_func():
    """获取广播函数"""
    return broadcast_update


# ============ 错误处理与 SPA 兜底 ============
# ⚠️ 注意：这个通配符路由必须放在代码的最底部！
# 它负责拦截所有未被上面的 API 或 StaticFiles 匹配的路由，将其指向前端的 index.html 以支持 React Router。
@app.get("/")
@app.get("/{full_path:path}")
async def spa_fallback(full_path: str = ""):
    index_path = os.path.join(_static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(
            index_path,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    raise HTTPException(404, "前端未构建，请先在 frontend 运行 npm run build 并将产物移入 backend/static")
