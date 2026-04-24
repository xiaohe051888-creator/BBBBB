"""
路由共享的Pydantic模型定义
"""
from typing import Optional, List
from pydantic import BaseModel, validator
from app.core.config import settings


class GameUploadItem(BaseModel):
    """单局开奖记录"""
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
    game_number: int
    result: str
    
    @validator("result")
    def validate_result(cls, v):
        if v not in ("庄", "闲", "和"):
            raise ValueError("开奖结果必须是：庄、闲、和")
        return v


class BetRequest(BaseModel):
    """下注请求"""
    game_number: int
    direction: str
    amount: float
    
    @validator("direction")
    def validate_direction(cls, v):
        if v not in ("庄", "闲"):
            raise ValueError("下注方向只能是：庄、闲")
        return v


class LoginRequest(BaseModel):
    """登录请求"""
    password: str


class ChangePasswordRequest(BaseModel):
    """修改密码请求"""
    old_password: str
    new_password: str
