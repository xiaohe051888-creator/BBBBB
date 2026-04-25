"""
路由共享的Pydantic模型定义
"""
from typing import List
from pydantic import BaseModel, validator, Field
from app.core.config import settings


class GameUploadItem(BaseModel):
    """单局开奖记录"""
    game_number: int = Field(..., ge=1, le=80, description="局号必须在 1 到 80 之间")
    result: str = Field(..., max_length=10)

    @validator("result")
    def validate_result(cls, v):
        if v not in ("庄", "闲", "和"):
            raise ValueError("开奖结果必须是：庄、闲、和")
        return v


class UploadRequest(BaseModel):
    """批量上传请求"""
    games: List[GameUploadItem]
    is_new_boot: bool = False
    
    @validator("games")
    def validate_games(cls, v):
        if not v:
            raise ValueError("上传数据不能为空")
        if len(v) > settings.MAX_UPLOAD_GAMES:
            raise ValueError(f"单次最多上传{settings.MAX_UPLOAD_GAMES}局")
        return v


class RevealRequest(BaseModel):
    """开奖请求"""
    game_number: int = Field(..., ge=1, le=80, description="局号必须在 1 到 80 之间")
    result: str = Field(..., max_length=10)

    @validator("result")
    def validate_result(cls, v):
        if v not in ("庄", "闲", "和"):
            raise ValueError("开奖结果必须是：庄、闲、和")
        return v


class LoginRequest(BaseModel):
    """管理员登录请求"""
    password: str = Field(..., min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    """修改密码请求"""
    old_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=4, max_length=128, description="新密码至少需要4个字符")
