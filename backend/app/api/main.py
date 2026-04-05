"""
FastAPI 主应用 - 百家乐分析预测系统
"""
import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, and_

from app.core.config import settings
from app.core.database import init_db, async_session
from app.models.schemas import (
    GameRecord, BetRecord, SystemLog, MistakeBook,
    SystemState, ModelVersion, AdminUser,
)


# ============ 全局状态 ============
workflow_engines: Dict[str, "WorkflowEngine"] = {}
ws_clients: List[WebSocket] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    # 启动时初始化
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
    
    print(f"✅ {settings.APP_NAME} v{settings.APP_VERSION} 启动成功")
    print(f"   访问地址: http://localhost:{settings.PORT}")
    
    yield
    
    # 关闭时停止所有引擎
    for engine in workflow_engines.values():
        await engine.stop()
    print("系统已关闭")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ API 路由 ============

# --- 系统控制 API ---

class StartRequest(BaseModel):
    table_id: str  # "26" 或 "27"


@app.post("/api/system/start")
async def start_system(req: StartRequest):
    """启动系统"""
    from app.services.workflow_engine import WorkflowEngine
    
    if req.table_id in workflow_engines:
        raise HTTPException(400, "该桌已在运行中")
    
    session = async_session()
    engine = WorkflowEngine(session)
    await engine.start(req.table_id)
    workflow_engines[req.table_id] = engine
    
    # 后台启动主循环
    asyncio.create_task(engine.run_main_loop())
    
    return {"status": "success", "message": f"{req.table_id}桌系统已启动"}


@app.post("/api/system/stop")
async def stop_system(table_id: str = Query(...)):
    """停止系统"""
    if table_id not in workflow_engines:
        raise HTTPException(400, "该桌未在运行")
    
    engine = workflow_engines[table_id]
    await engine.stop()
    del workflow_engines[table_id]
    
    return {"status": "success", "message": "系统已停止"}


@app.get("/api/system/state")
async def get_system_state(table_id: str = Query(...)):
    """获取系统状态"""
    async with async_session() as session:
        stmt = select(SystemState).where(SystemState.table_id == table_id)
        result = await session.execute(stmt)
        state = result.scalar_one_or_none()
        
        if not state:
            return {
                "table_id": table_id,
                "status": "已停止",
                "boot_number": 0,
                "game_number": 0,
                "balance": settings.DEFAULT_BALANCE,
            }
        
        return {
            "table_id": state.table_id,
            "status": state.status,
            "boot_number": state.boot_number,
            "game_number": state.game_number,
            "current_game_result": state.current_game_result,
            "predict_direction": state.predict_direction,
            "predict_confidence": state.predict_confidence,
            "current_model_version": state.current_model_version,
            "current_bet_tier": state.current_bet_tier,
            "balance": state.balance,
            "consecutive_errors": state.consecutive_errors,
            "health_score": state.health_score,
        }


@app.get("/api/system/health")
async def get_health_score(table_id: str = Query(...)):
    """获取系统健康分"""
    async with async_session() as session:
        stmt = select(SystemState).where(SystemState.table_id == table_id)
        result = await session.execute(stmt)
        state = result.scalar_one_or_none()
        
        if not state:
            return {"health_score": 100, "crawl_stability": 100, "model_stability": 100, "settlement_consistency": 100}
        
        return {
            "health_score": state.health_score,
            "crawl_stability": state.crawl_stability,
            "model_stability": state.model_stability,
            "settlement_consistency": state.settlement_consistency,
        }


# --- 开奖记录 API ---

@app.get("/api/games")
async def get_game_records(
    table_id: str = Query(...),
    boot_number: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("game_number", regex="^(game_number|profit_loss|bet_amount)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
):
    """获取开奖记录（分页）"""
    async with async_session() as session:
        query = select(GameRecord).where(GameRecord.table_id == table_id)
        
        if boot_number is not None:
            query = query.where(GameRecord.boot_number == boot_number)
        
        # 排序
        order_col = getattr(GameRecord, sort_by, GameRecord.game_number)
        query = query.order_by(order_col.desc() if sort_order == "desc" else order_col.asc())
        
        # 总数
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar() or 0
        
        # 分页
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
        
        # 置顶优先，然后按时间倒序
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
        # 总局数
        total_stmt = select(func.count()).select_from(
            select(GameRecord).where(
                GameRecord.table_id == table_id,
                GameRecord.predict_correct.isnot(None),
            ).subquery()
        )
        total_result = await session.execute(total_stmt)
        total_games = total_result.scalar() or 0
        
        # 命中数
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
    """获取当前余额"""
    stmt = select(SystemState).where(SystemState.table_id == table_id)
    result = await session.execute(stmt)
    state = result.scalar_one_or_none()
    return state.balance if state else settings.DEFAULT_BALANCE


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
        
        # 检查锁定
        if admin.locked_until and admin.locked_until > datetime.now():
            raise HTTPException(403, "账户已锁定，请10分钟后重试")
        
        # 验证密码
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
        
        # 登录成功
        admin.login_attempts = 0
        admin.locked_until = None
        await session.commit()
        
        # 创建简单token
        from jose import jwt
        token = jwt.encode(
            {"sub": admin.username, "exp": datetime.utcnow() + timedelta(hours=24)},
            "baccarat-secret-key",  # 生产环境应使用环境变量
            algorithm="HS256",
        )
        
        return {
            "token": token,
            "must_change_password": admin.must_change_password,
            "username": admin.username,
        }


@app.post("/api/admin/change-password")
async def change_password(req: ChangePasswordRequest):
    """修改密码"""
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
async def get_model_versions():
    """获取模型版本列表"""
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
    table_name: str = Query(..., regex="^(game_records|bet_records|system_logs|mistake_book)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """查看数据库记录（管理员功能）"""
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
        
        # 转为字典
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


# --- WebSocket 实时推送 ---

@app.websocket("/ws/{table_id}")
async def websocket_endpoint(websocket: WebSocket, table_id: str):
    """WebSocket 实时推送"""
    await websocket.accept()
    ws_clients.append(websocket)
    
    try:
        while True:
            # 保持连接
            data = await websocket.receive_text()
            
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
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
        except:
            ws_clients.remove(client)
