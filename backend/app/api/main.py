"""
FastAPI 主应用 - 百家乐分析预测系统（手动模式）
"""
import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel, validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_

from app.core.config import settings
from app.core.database import init_db, async_session
from app.models.schemas import (
    GameRecord, BetRecord, SystemLog, MistakeBook,
    SystemState, ModelVersion, AdminUser,
)


# ============ 认证工具函数 ============

def _extract_token(request: Request, query_token: Optional[str] = None) -> str:
    """
    从请求中提取 JWT token（支持两种方式）：
    1. Authorization: Bearer <token>  (Header方式，前端axios拦截器使用)
    2. ?token=<token>  (Query参数方式，WebSocket/兼容)
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    if query_token:
        return query_token
    raise HTTPException(401, "缺少认证凭证（需要Bearer Token或token参数）")


async def get_current_user(
    request: Request,
    token: Optional[str] = Query(None, alias="token"),
) -> dict:
    """验证JWT token，支持Header Bearer和Query参数双模式"""
    from jose import jwt, JWTError

    raw_token = _extract_token(request, token)
    try:
        payload = jwt.decode(
            raw_token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(401, "无效的认证凭证")
        return {"username": username}
    except JWTError:
        raise HTTPException(401, "无效或已过期的认证凭证")


def _parse_cors_origins() -> List[str]:
    """解析CORS允许的来源列表"""
    origins_str = settings.CORS_ORIGINS.strip()
    if origins_str == "*":
        return ["*"]
    return [o.strip() for o in origins_str.split(",") if o.strip()] or ["http://localhost:5173"]


# ============ 全局状态 ============
ws_clients: List[WebSocket] = []


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
    
    # 注入广播函数到手动游戏服务
    from app.services.manual_game_service import set_broadcast_func
    set_broadcast_func(broadcast_update)
    
    # 恢复内存状态（从数据库）
    from app.services.manual_game_service import sync_balance_from_db
    async with async_session() as session:
        for table_id in ["26", "27"]:
            await sync_balance_from_db(session, table_id)
    
    print(f"✅ {settings.APP_NAME} v{settings.APP_VERSION} 启动成功（手动模式）")
    print(f"   访问地址: http://localhost:{settings.PORT}")
    
    yield
    
    print("系统已关闭")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS配置
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

    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws") or full_path.startswith("assets/"):
            raise HTTPException(404, f"路由不存在: /{full_path}")
        index_path = os.path.join(_static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        raise HTTPException(404, "前端未构建，请先运行 npm run build")

    print(f"   📦 前端静态文件已挂载: {_static_dir}")


# ============ API 路由 ============

# --- 系统状态 API ---

@app.get("/api/system/state")
async def get_system_state(table_id: str = Query(...)):
    """获取系统状态"""
    from app.services.manual_game_service import get_current_state
    
    async with async_session() as session:
        stmt = select(SystemState).where(SystemState.table_id == table_id)
        result = await session.execute(stmt)
        state = result.scalar_one_or_none()
        
        # 获取内存态（更实时）
        mem_state = await get_current_state(table_id)
        
        if not state:
            return {
                "table_id": table_id,
                "status": mem_state["status"],
                "boot_number": mem_state["boot_number"],
                "game_number": mem_state["next_game_number"] - 1,
                "balance": mem_state["balance"],
                "predict_direction": mem_state["predict_direction"],
                "predict_confidence": mem_state["predict_confidence"],
                "current_bet_tier": mem_state["predict_bet_tier"],
                "consecutive_errors": mem_state["consecutive_errors"],
                "health_score": 100.0,
                "pending_bet": mem_state["pending_bet"],
                "next_game_number": mem_state["next_game_number"],
            }
        
        return {
            "table_id": state.table_id,
            "status": mem_state["status"],
            "boot_number": state.boot_number,
            "game_number": state.game_number,
            "current_game_result": state.current_game_result,
            "predict_direction": mem_state["predict_direction"] or state.predict_direction,
            "predict_confidence": mem_state["predict_confidence"] or state.predict_confidence,
            "current_model_version": state.current_model_version,
            "current_bet_tier": mem_state["predict_bet_tier"] or state.current_bet_tier,
            "balance": mem_state["balance"],
            "consecutive_errors": mem_state["consecutive_errors"],
            "health_score": state.health_score,
            "pending_bet": mem_state["pending_bet"],
            "next_game_number": mem_state["next_game_number"],
        }


@app.get("/api/system/health")
async def get_health_score(table_id: str = Query(...)):
    """获取系统健康分"""
    async with async_session() as session:
        stmt = select(SystemState).where(SystemState.table_id == table_id)
        result = await session.execute(stmt)
        state = result.scalar_one_or_none()
        
        if not state:
            return {"health_score": 100, "model_stability": 100, "settlement_consistency": 100}
        
        return {
            "health_score": state.health_score,
            "model_stability": state.model_stability,
            "settlement_consistency": state.settlement_consistency,
        }


# --- 手动游戏 API ---

class GameUploadItem(BaseModel):
    game_number: int
    result: str  # "庄"/"闲"/"和"
    
    @validator("result")
    def validate_result(cls, v):
        if v not in ("庄", "闲", "和"):
            raise ValueError("开奖结果必须是：庄、闲、和")
        return v
    
    @validator("game_number")
    def validate_game_number(cls, v):
        if v < 1:
            raise ValueError("局号必须大于0")
        return v


class UploadRequest(BaseModel):
    table_id: str
    games: List[GameUploadItem]
    boot_number: Optional[int] = None
    
    @validator("games")
    def validate_games(cls, v):
        if not v:
            raise ValueError("上传数据不能为空")
        if len(v) > settings.MAX_UPLOAD_GAMES:
            raise ValueError(f"单次最多上传{settings.MAX_UPLOAD_GAMES}局")
        return v


class RevealRequest(BaseModel):
    table_id: str
    game_number: int
    result: str
    
    @validator("result")
    def validate_result(cls, v):
        if v not in ("庄", "闲", "和"):
            raise ValueError("开奖结果必须是：庄、闲、和")
        return v


class BetRequest(BaseModel):
    table_id: str
    game_number: int
    direction: str
    amount: float
    
    @validator("direction")
    def validate_direction(cls, v):
        if v not in ("庄", "闲"):
            raise ValueError("下注方向只能是：庄、闲")
        return v


@app.post("/api/games/upload")
async def upload_game_results(req: UploadRequest):
    """
    手动上传批量开奖记录（最多66局）
    上传后自动计算五路走势图，触发AI分析预测下一局
    """
    from app.services.manual_game_service import upload_games, run_ai_analysis
    
    async with async_session() as session:
        upload_result = await upload_games(
            db=session,
            table_id=req.table_id,
            games=[g.dict() for g in req.games],
            boot_number=req.boot_number,
        )
    
    if not upload_result["success"]:
        raise HTTPException(400, upload_result.get("error", "上传失败"))
    
    # 异步触发AI分析（不阻塞上传响应）
    async def _trigger_analysis():
        async with async_session() as session:
            await run_ai_analysis(
                db=session,
                table_id=req.table_id,
                boot_number=upload_result["boot_number"],
            )
    
    asyncio.create_task(_trigger_analysis())
    
    return {
        "success": True,
        "uploaded": upload_result["uploaded"],
        "boot_number": upload_result["boot_number"],
        "max_game_number": upload_result["max_game_number"],
        "next_game_number": upload_result["next_game_number"],
        "message": f"成功上传{upload_result['uploaded']}局数据，AI分析正在进行中...",
    }


@app.post("/api/games/bet")
async def place_bet(req: BetRequest):
    """下注"""
    from app.services.manual_game_service import place_bet as _place_bet
    
    async with async_session() as session:
        result = await _place_bet(
            db=session,
            table_id=req.table_id,
            game_number=req.game_number,
            direction=req.direction,
            amount=req.amount,
        )
    
    if not result["success"]:
        raise HTTPException(400, result.get("error", "下注失败"))
    
    return result


@app.post("/api/games/reveal")
async def reveal_game(req: RevealRequest):
    """
    开奖 - 输入开奖结果，结算注单，走势图更新，触发下一局AI分析
    """
    from app.services.manual_game_service import reveal_game as _reveal, run_ai_analysis
    
    async with async_session() as session:
        result = await _reveal(
            db=session,
            table_id=req.table_id,
            game_number=req.game_number,
            result=req.result,
        )
    
    if not result["success"]:
        raise HTTPException(400, result.get("error", "开奖失败"))
    
    # 获取当前靴号，触发下一局AI分析
    from app.services.manual_game_service import get_session
    sess = get_session(req.table_id)
    boot_number = sess.boot_number
    
    async def _trigger_next_analysis():
        async with async_session() as session:
            await run_ai_analysis(
                db=session,
                table_id=req.table_id,
                boot_number=boot_number,
            )
    
    asyncio.create_task(_trigger_next_analysis())
    
    return {
        **result,
        "message": f"第{req.game_number}局开奖{req.result}，正在分析下一局...",
    }


@app.get("/api/games/current-state")
async def get_game_current_state(table_id: str = Query(...)):
    """获取当前手动游戏内存状态（等待开奖、预测结果等）"""
    from app.services.manual_game_service import get_current_state
    return await get_current_state(table_id)


# --- 开奖记录 API ---

@app.get("/api/games")
async def get_game_records(
    table_id: str = Query(...),
    boot_number: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("game_number", pattern="^(game_number|profit_loss|bet_amount)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
):
    """获取开奖记录（分页）"""
    async with async_session() as session:
        query = select(GameRecord).where(GameRecord.table_id == table_id)
        
        if boot_number is not None:
            query = query.where(GameRecord.boot_number == boot_number)
        
        order_col = getattr(GameRecord, sort_by, GameRecord.game_number)
        query = query.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
        
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar() or 0
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await session.execute(query)
        records = result.scalars().all()
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": [
                {
                    "game_number": r.game_number,
                    "result": r.result,
                    "result_time": r.result_time.isoformat() if r.result_time else None,
                    "predict_direction": r.predict_direction,
                    "predict_correct": r.predict_correct,
                    "error_id": r.error_id,
                    "settlement_status": r.settlement_status,
                    "profit_loss": r.profit_loss,
                    "balance_after": r.balance_after,
                }
                for r in records
            ],
        }


# --- 下注记录 API ---

@app.get("/api/bets")
async def get_bet_records(
    table_id: str = Query(...),
    boot_number: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """获取下注记录（分页）"""
    async with async_session() as session:
        query = select(BetRecord).where(BetRecord.table_id == table_id)
        
        if boot_number is not None:
            query = query.where(BetRecord.boot_number == boot_number)
        
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar() or 0
        
        query = query.order_by(BetRecord.game_number.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await session.execute(query)
        records = result.scalars().all()
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": [
                {
                    "game_number": r.game_number,
                    "bet_time": r.bet_time.isoformat() if r.bet_time else None,
                    "bet_direction": r.bet_direction,
                    "bet_amount": r.bet_amount,
                    "bet_tier": r.bet_tier,
                    "status": r.status,
                    "game_result": r.game_result,
                    "error_id": r.error_id,
                    "settlement_amount": r.settlement_amount,
                    "profit_loss": r.profit_loss,
                    "balance_before": r.balance_before,
                    "balance_after": r.balance_after,
                    "adapt_summary": r.adapt_summary,
                }
                for r in records
            ],
        }


# --- 实盘日志 API ---

@app.get("/api/logs")
async def get_logs(
    table_id: str = Query(...),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    game_number: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """获取实盘日志（分页+筛选）"""
    async with async_session() as session:
        query = select(SystemLog).where(SystemLog.table_id == table_id)
        
        if category:
            query = query.where(SystemLog.category == category)
        if priority:
            query = query.where(SystemLog.priority == priority)
        if game_number:
            query = query.where(SystemLog.game_number == game_number)
        
        query = query.order_by(SystemLog.is_pinned.desc(), SystemLog.log_time.desc())
        
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar() or 0
        
        query = query.offset((page - 1) * page_size).limit(page_size)
        result = await session.execute(query)
        logs = result.scalars().all()
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": [
                {
                    "id": log.id,
                    "log_time": log.log_time.isoformat() if log.log_time else None,
                    "game_number": log.game_number,
                    "event_code": log.event_code,
                    "event_type": log.event_type,
                    "event_result": log.event_result,
                    "description": log.description,
                    "category": log.category,
                    "priority": log.priority,
                    "source_module": log.source_module,
                    "event_key": log.event_key,
                    "is_pinned": log.is_pinned,
                }
                for log in logs
            ],
        }


# --- 统计 API ---

@app.get("/api/stats")
async def get_statistics(table_id: str = Query(...)):
    """获取统计信息"""
    async with async_session() as session:
        total_stmt = select(func.count()).select_from(
            select(GameRecord).where(
                GameRecord.table_id == table_id,
                GameRecord.predict_correct.isnot(None),
            ).subquery()
        )
        total_result = await session.execute(total_stmt)
        total_games = total_result.scalar() or 0
        
        hit_stmt = select(func.count()).select_from(
            select(GameRecord).where(
                GameRecord.table_id == table_id,
                GameRecord.predict_correct == True,
            ).subquery()
        )
        hit_result = await session.execute(hit_stmt)
        hit_count = hit_result.scalar() or 0
        
        accuracy = (hit_count / total_games * 100) if total_games > 0 else 0
        
        return {
            "total_games": total_games,
            "hit_count": hit_count,
            "miss_count": total_games - hit_count,
            "accuracy": round(accuracy, 1),
            "balance": await _get_balance(table_id, session),
        }


async def _get_balance(table_id: str, session) -> float:
    """获取当前余额（优先从内存获取）"""
    from app.services.manual_game_service import get_session
    sess = get_session(table_id)
    if sess.balance != settings.DEFAULT_BALANCE or sess.next_game_number > 1:
        return sess.balance
    
    stmt = select(SystemState).where(SystemState.table_id == table_id)
    result = await session.execute(stmt)
    state = result.scalar_one_or_none()
    return state.balance if state else settings.DEFAULT_BALANCE


# --- 走势图 API ---

@app.get("/api/roads")
async def get_road_maps(
    table_id: str = Query(...),
    boot_number: Optional[int] = Query(None),
):
    """获取五路走势图数据"""
    from app.services.road_engine import UnifiedRoadEngine
    
    async with async_session() as session:
        query = select(GameRecord).where(
            GameRecord.table_id == table_id,
            GameRecord.result.in_(["庄", "闲"]),
        ).order_by(GameRecord.game_number)
        
        if boot_number is not None:
            query = query.where(GameRecord.boot_number == boot_number)
        
        result = await session.execute(query)
        records = result.scalars().all()
        
        if not records:
            return {
                "table_id": table_id,
                "boot_number": boot_number,
                "total_games": 0,
                "roads": {
                    "大路": [],
                    "珠盘路": [],
                    "大眼仔路": [],
                    "小路": [],
                    "螳螂路": [],
                },
            }
        
        engine = UnifiedRoadEngine()
        for r in records:
            engine.process_game(r.game_number, r.result)
        
        five_roads = engine.calculate_all_roads()
        
        def road_to_dict(road):
            return {
                "display_name": road.display_name,
                "max_columns": road.max_columns,
                "max_rows": road.max_rows,
                "points": [
                    {
                        "game_number": p.game_number,
                        "column": p.column,
                        "row": p.row,
                        "value": p.value,
                        "is_new_column": p.is_new_column,
                        "error_id": p.error_id,
                    }
                    for p in road.points
                ],
            }
        
        actual_boot = boot_number or (records[0].boot_number if records else 0)
        
        return {
            "table_id": table_id,
            "boot_number": actual_boot,
            "total_games": len(records),
            "roads": {
                "大路": road_to_dict(five_roads.big_road),
                "珠盘路": road_to_dict(five_roads.bead_road),
                "大眼仔路": road_to_dict(five_roads.big_eye_boy),
                "小路": road_to_dict(five_roads.small_road),
                "螳螂路": road_to_dict(five_roads.cockroach_road),
            },
        }


@app.get("/api/roads/raw")
async def get_road_raw_data(
    table_id: str = Query(...),
    boot_number: Optional[int] = Query(None),
):
    """获取原始开奖结果列表（用于前端本地计算走势图）"""
    async with async_session() as session:
        query = select(GameRecord).where(GameRecord.table_id == table_id).order_by(GameRecord.game_number)
        
        if boot_number is not None:
            query = query.where(GameRecord.boot_number == boot_number)
        
        result = await session.execute(query)
        records = result.scalars().all()
        
        return {
            "table_id": table_id,
            "boot_number": boot_number or (records[0].boot_number if records else 0),
            "total": len(records),
            "data": [
                {
                    "game_number": r.game_number,
                    "result": r.result,
                    "result_time": r.result_time.isoformat() if r.result_time else None,
                    "predict_direction": r.predict_direction,
                    "predict_correct": r.predict_correct,
                }
                for r in records
            ],
        }


# --- AI 分析 API ---

@app.get("/api/analysis/latest")
async def get_latest_analysis(table_id: str = Query(...)):
    """获取最新一局的AI三模型分析结果"""
    from app.services.manual_game_service import get_current_state
    
    # 优先从内存获取（最新）
    mem = await get_current_state(table_id)
    if mem.get("analysis"):
        analysis = mem["analysis"]
        return {
            "table_id": table_id,
            "banker_model": {
                "summary": analysis.get("banker_summary"),
                "time": analysis.get("time"),
            },
            "player_model": {
                "summary": analysis.get("player_summary"),
                "time": analysis.get("time"),
            },
            "combined_model": {
                "summary": analysis.get("combined_summary"),
                "confidence": mem.get("predict_confidence"),
                "bet_tier": mem.get("predict_bet_tier"),
                "prediction": mem.get("predict_direction"),
                "time": analysis.get("time"),
            },
            "has_data": True,
        }
    
    # 从日志中提取（历史记录）
    async with async_session() as session:
        from sqlalchemy import or_
        
        stmt = select(SystemLog).where(
            SystemLog.table_id == table_id,
            SystemLog.event_code.in_([
                "LOG-MDL-001",
                "LOG-MDL-002",
                "LOG-MDL-003",
            ]),
        ).order_by(SystemLog.log_time.desc()).limit(10)
        
        result = await session.execute(stmt)
        logs = result.scalars().all()
        
        banker_log = next((l for l in logs if l.event_code == "LOG-MDL-001"), None)
        player_log = next((l for l in logs if l.event_code == "LOG-MDL-002"), None)
        combined_log = next((l for l in logs if l.event_code == "LOG-MDL-003"), None)
        
        state_stmt = select(SystemState).where(SystemState.table_id == table_id)
        state_result = await session.execute(state_stmt)
        state = state_result.scalar_one_or_none()
        
        return {
            "table_id": table_id,
            "banker_model": {
                "summary": banker_log.description if banker_log else None,
                "time": banker_log.log_time.isoformat() if banker_log else None,
            },
            "player_model": {
                "summary": player_log.description if player_log else None,
                "time": player_log.log_time.isoformat() if player_log else None,
            },
            "combined_model": {
                "summary": combined_log.description if combined_log else None,
                "confidence": (state.predict_confidence if state else None),
                "bet_tier": (state.current_bet_tier if state else None),
                "prediction": (state.predict_direction if state else None),
                "time": combined_log.log_time.isoformat() if combined_log else None,
            },
            "has_data": bool(combined_log),
        }


# --- 管理员 API ---

class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


@app.post("/api/admin/login")
async def admin_login(req: LoginRequest):
    """管理员登录"""
    import bcrypt as _bcrypt
    
    async with async_session() as session:
        stmt = select(AdminUser).where(AdminUser.username == req.username)
        result = await session.execute(stmt)
        admin = result.scalar_one_or_none()
        
        if not admin:
            raise HTTPException(401, "用户名或密码错误")
        
        if admin.locked_until and admin.locked_until > datetime.now():
            raise HTTPException(403, "账户已锁定，请10分钟后重试")
        
        password_bytes = req.password.encode('utf-8')
        try:
            valid = _bcrypt.checkpw(password_bytes, admin.password_hash.encode('utf-8'))
        except Exception:
            valid = False
        
        if not valid:
            admin.login_attempts += 1
            
            if admin.login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
                admin.locked_until = datetime.now() + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
                await session.commit()
                raise HTTPException(403, "连续输错密码5次，账户已锁定10分钟")
            
            await session.commit()
            remaining = settings.MAX_LOGIN_ATTEMPTS - admin.login_attempts
            raise HTTPException(401, f"密码错误，还剩{remaining}次机会")
        
        admin.login_attempts = 0
        admin.locked_until = None
        await session.commit()
        
        from jose import jwt
        token = jwt.encode(
            {"sub": admin.username, "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRE_HOURS)},
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )
        
        return {
            "token": token,
            "must_change_password": admin.must_change_password,
            "username": admin.username,
        }


@app.post("/api/admin/change-password")
async def change_password(req: ChangePasswordRequest, _: dict = Depends(get_current_user)):
    """修改密码（需认证）"""
    import bcrypt as _bcrypt
    
    async with async_session() as session:
        stmt = select(AdminUser).where(AdminUser.username == "admin")
        result = await session.execute(stmt)
        admin = result.scalar_one_or_none()
        
        old_bytes = req.old_password.encode('utf-8')
        try:
            valid = _bcrypt.checkpw(old_bytes, admin.password_hash.encode('utf-8'))
        except Exception:
            valid = False
        
        if not admin or not valid:
            raise HTTPException(401, "原密码错误")
        
        new_bytes = req.new_password.encode('utf-8')
        admin.password_hash = _bcrypt.hashpw(new_bytes, _bcrypt.gensalt()).decode('utf-8')
        admin.must_change_password = False
        await session.commit()
        
        return {"status": "success", "message": "密码修改成功"}


@app.get("/api/admin/model-versions")
async def get_model_versions(_: dict = Depends(get_current_user)):
    """获取模型版本列表（需认证）"""
    async with async_session() as session:
        stmt = select(ModelVersion).order_by(desc(ModelVersion.created_at))
        result = await session.execute(stmt)
        versions = result.scalars().all()
        
        return {
            "data": [
                {
                    "version": v.version,
                    "created_at": v.created_at.isoformat() if v.created_at else None,
                    "training_range": v.training_range,
                    "training_sample_count": v.training_sample_count,
                    "accuracy_before": v.accuracy_before,
                    "accuracy_after": v.accuracy_after,
                    "key_changes": v.key_changes,
                    "is_active": v.is_active,
                    "total_runs": v.total_runs,
                    "hit_count": v.hit_count,
                }
                for v in versions
            ]
        }


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
                row[column.name] = val
            data.append(row)
        
        return {"table": table_name, "data": data, "page": page, "page_size": page_size}


# --- AI 学习 API ---

@app.post("/api/admin/ai-learning/start")
async def start_ai_learning(
    table_id: str = Query(...),
    boot_number: int = Query(...),
    _: dict = Depends(get_current_user),
):
    """启动AI学习任务（需认证）"""
    from app.services.ai_learning_service import AILearningService
    
    async with async_session() as session:
        service = AILearningService(session)
        
        status = await service.get_learning_status()
        if status["is_learning"]:
            raise HTTPException(400, f"学习任务正在执行中: {status['current_task']}")
        
        asyncio.create_task(service.start_learning(table_id, boot_number))
        
        return {
            "status": "started",
            "message": f"AI学习已启动，正在分析 {table_id} 第{boot_number}靴数据...",
        }


@app.get("/api/admin/ai-learning/status")
async def get_ai_learning_status(_: dict = Depends(get_current_user)):
    """获取AI学习状态（需认证）"""
    from app.services.ai_learning_service import AILearningService
    
    return {
        "is_learning": AILearningService._is_learning,
        "current_task": AILearningService._current_task,
        "min_samples": getattr(AILearningService, '_min_samples', 200),
        "max_versions": getattr(AILearningService, '_max_versions', 5),
    }


# --- 智能选模 API ---

@app.post("/api/system/select-model")
async def select_best_model(
    table_id: str = Query(...),
    force_version: Optional[str] = Query(None),
    __: dict = Depends(get_current_user),
):
    """执行智能选模（需认证）"""
    from app.services.smart_model_selector import SmartModelSelector
    
    async with async_session() as session:
        selector = SmartModelSelector(session)
        result = await selector.select_best_model(table_id, force_version=force_version)
        return result


# --- 三模型状态 API ---

@app.get("/api/admin/three-model-status")
async def get_three_model_status(_: dict = Depends(get_current_user)):
    """获取三模型配置和状态（需认证）"""
    models_config = {
        "banker": {
            "name": "OpenAI GPT-4o mini (庄模型)",
            "provider": "openai",
            "model": settings.OPENAI_MODEL,
            "api_key_set": bool(settings.OPENAI_API_KEY and len(settings.OPENAI_API_KEY) > 10),
            "role": "收集庄向证据链",
        },
        "player": {
            "name": f"Anthropic {settings.ANTHROPIC_MODEL} (闲模型)",
            "provider": "anthropic",
            "model": settings.ANTHROPIC_MODEL,
            "api_key_set": bool(settings.ANTHROPIC_API_KEY and len(settings.ANTHROPIC_API_KEY) > 10),
            "role": "收集闲向证据链",
        },
        "combined": {
            "name": f"Google {settings.GEMINI_MODEL} (综合模型)",
            "provider": "google",
            "model": settings.GEMINI_MODEL,
            "api_key_set": bool(settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 10),
            "role": "综合分析并给出最终预测",
        },
    }
    
    all_keys_set = all(m["api_key_set"] for m in models_config.values())
    
    return {
        "status": "ready" if all_keys_set else "incomplete",
        "all_api_keys_configured": all_keys_set,
        "models": models_config,
        "smart_router_enabled": True,
        "fallback_policy": "永不降级（铁律：必须满血3模型）",
    }


# --- WebSocket 实时推送 ---

@app.websocket("/ws/{table_id}")
async def websocket_endpoint(websocket: WebSocket, table_id: str):
    """WebSocket 实时推送"""
    token = websocket.query_params.get("token")
    if token:
        try:
            from jose import jwt, JWTError
            jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        except (JWTError, Exception):
            await websocket.close(code=4001, reason="无效的认证凭证")
            return
    
    await websocket.accept()
    ws_clients.append(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        if websocket in ws_clients:
            ws_clients.remove(websocket)


async def broadcast_update(table_id: str, event_type: str, data: Dict):
    """广播更新到WebSocket客户端"""
    message = {
        "type": event_type,
        "table_id": table_id,
        "data": data,
        "timestamp": datetime.now().isoformat(),
    }
    
    for client in ws_clients[:]:
        try:
            await client.send_json(message)
        except Exception:
            if client in ws_clients:
                ws_clients.remove(client)
