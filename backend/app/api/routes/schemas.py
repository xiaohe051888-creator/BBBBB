"""
路由共享的Pydantic模型定义
"""
from typing import List, Optional, Literal
from pydantic import BaseModel, field_validator, Field
from app.core.config import settings


class GameUploadItem(BaseModel):
    """单局开奖记录"""
    game_number: int = Field(..., ge=1, le=72, description="局号必须在 1 到 72 之间")
    result: str = Field(..., max_length=10)

    @field_validator("result")
    @classmethod
    def validate_result(cls, v):
        if v not in ("庄", "闲", "和"):
            raise ValueError("开奖结果必须是：庄、闲、和")
        return v


class UploadRequest(BaseModel):
    """批量上传请求"""
    games: List[GameUploadItem]
    mode: Optional[Literal["reset_current_boot", "new_boot"]] = None
    balance_mode: Optional[Literal["keep", "reset_default"]] = None
    run_deep_learning: Optional[bool] = None

    @field_validator("games")
    @classmethod
    def validate_games(cls, v):
        if not v:
            raise ValueError("上传数据不能为空")
        if len(v) > settings.MAX_UPLOAD_GAMES:
            raise ValueError(f"单次最多上传{settings.MAX_UPLOAD_GAMES}局")
        return v


class RevealRequest(BaseModel):
    """开奖请求"""
    game_number: int = Field(..., ge=1, le=72, description="局号必须在 1 到 72 之间")
    result: str = Field(..., max_length=10)

    @field_validator("result")
    @classmethod
    def validate_result(cls, v):
        if v not in ("庄", "闲", "和"):
            raise ValueError("开奖结果必须是：庄、闲、和")
        return v


class RetrySingleAiAnalysisRequest(BaseModel):
    """单AI失败后手动重新分析请求"""
    boot_number: int = Field(..., ge=1)
    game_number: int = Field(..., ge=1, le=72)


class LoginRequest(BaseModel):
    """管理员登录请求"""
    username: str | None = Field(None, min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class UserLoginRequest(BaseModel):
    """用户登录请求"""
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    """修改密码请求"""
    old_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=4, max_length=128, description="新密码至少需要4个字符")


class MaintenanceResetAllRequest(BaseModel):
    """全量清空请求"""
    confirm_password: str | None = Field(None, min_length=1, max_length=128)


class MaintenanceAlertsAcknowledgeRequest(BaseModel):
    """首页严重告警确认请求"""
    latest_alert_log_id: int = Field(..., ge=0)


class ApiConfigPayload(BaseModel):
    role: str = Field(..., description="banker | player | combined")
    provider: str = Field(..., description="Model provider")
    model: str = Field(..., description="Model name")
    api_key: str = Field(..., description="API Key")
    base_url: str | None = Field(None, description="Custom base URL")


class SingleAiPromptTemplatesResponse(BaseModel):
    prediction_mode: str
    active_version: str | None = None
    prediction_template: str | None = None
    realtime_strategy_template: str | None = None


class SingleAiPromptTemplatesUpdateRequest(BaseModel):
    prediction_template: str | None = None
    realtime_strategy_template: str | None = None


class AdminCreateUserRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)
    is_active: bool = True
    must_change_password: bool = True


class AdminUpdateUserRequest(BaseModel):
    username: str | None = Field(None, min_length=1, max_length=64)
    password: str | None = Field(None, min_length=4, max_length=128)
    is_active: bool | None = None
    must_change_password: bool | None = None


class AdminUserItem(BaseModel):
    id: int
    username: str
    is_active: bool
    must_change_password: bool
    created_at: str | None = None
    updated_at: str | None = None
