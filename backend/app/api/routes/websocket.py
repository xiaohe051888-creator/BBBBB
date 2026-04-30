"""
WebSocket路由
"""
import asyncio
from typing import List, Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from datetime import datetime
from jose import jwt, JWTError

from app.core.config import settings
from app.core.async_utils import spawn_task

router = APIRouter(tags=["WebSocket"])

# 全局WebSocket客户端列表 - 使用锁保护并发访问
ws_clients: List[WebSocket] = []
ws_clients_lock = asyncio.Lock()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket 实时推送"""
    token = websocket.query_params.get("token")
    if token:
        try:
            jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        except (JWTError, Exception):
            await websocket.close(code=4001, reason="无效的认证凭证")
            return
    
    await websocket.accept()
    async with ws_clients_lock:
        ws_clients.append(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        # 客户端正常断开连接
        pass
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").error(f"WebSocket error: {e}")
    finally:
        # 终极兜底：无论由于网络断开、系统错误还是协程取消 (CancelledError)，
        # 必定执行清理逻辑，绝不留下占用广播资源的“幽灵僵尸连接”
        async with ws_clients_lock:
            if websocket in ws_clients:
                ws_clients.remove(websocket)


async def _remove_client(client: WebSocket):
    """异步移除断开的客户端"""
    async with ws_clients_lock:
        if client in ws_clients:
            ws_clients.remove(client)


async def broadcast_update(event_type: str, data: Dict):
    """广播更新到WebSocket客户端"""
    message = {
        "type": event_type,
        "data": data,
        "timestamp": datetime.now().isoformat(),
    }
    
    # 先复制客户端列表，避免在迭代时修改
    async with ws_clients_lock:
        active_clients = ws_clients.copy()
    
    # 广播到所有活跃客户端
    for client in active_clients:
        try:
            await client.send_json(message)
        except Exception:
            # 异步清理断开的客户端
            spawn_task(_remove_client(client))
