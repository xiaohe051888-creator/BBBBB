"""
认证工具函数
"""
from typing import Optional
from fastapi import HTTPException, Request, Depends, Query
from jose import jwt, JWTError
from app.core.config import settings


def extract_token(request: Request, query_token: Optional[str] = None) -> str:
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
    raw_token = extract_token(request, token)
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
