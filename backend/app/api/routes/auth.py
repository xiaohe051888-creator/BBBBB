"""
认证相关路由
"""
import bcrypt as _bcrypt
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, desc

from app.core.database import async_session
from app.models.schemas import AdminUser, ModelVersion
from app.core.config import settings
from jose import jwt

from app.api.routes.schemas import LoginRequest, ChangePasswordRequest
from app.api.routes.utils import get_current_user

router = APIRouter(prefix="/api/admin", tags=["认证"])


@router.post("/login")
async def admin_login(req: LoginRequest):
    """管理员登录"""
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


@router.post("/change-password")
async def change_password(req: ChangePasswordRequest, _: dict = Depends(get_current_user)):
    """修改密码（需认证）"""
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


@router.get("/model-versions")
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


# @router.get("/database-records")
# async def get_database_records(
#     table_name: str = Depends(lambda: None),  # Placeholder, actual in Depends
#     page: int = Depends(lambda: 1),
#     page_size: int = Depends(lambda: 50),
#     # _: dict = Depends(get_current_user),
# ):
#     """查看数据库记录（需认证）- 请使用实际参数"""
#     pass  # 此路由已在main.py中完整定义


@router.get("/three-model-status")
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
