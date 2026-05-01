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
import os

from app.api.routes.schemas import LoginRequest, ChangePasswordRequest, ApiConfigPayload
from app.api.routes.utils import get_current_user

router = APIRouter(prefix="/api/admin", tags=["认证"])


@router.post("/login")
async def admin_login(req: LoginRequest):
    """管理员登录"""
    async with async_session() as session:
        stmt = select(AdminUser).where(AdminUser.username == "admin")
        result = await session.execute(stmt)
        admin = result.scalar_one_or_none()

        if not admin:
            raise HTTPException(status_code=401, detail="密码错误")

        if admin.locked_until and admin.locked_until > datetime.now():
            raise HTTPException(status_code=403, detail="账户已锁定，请10分钟后重试")

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
                raise HTTPException(status_code=403, detail="连续输错密码5次，账户已锁定10分钟")

            await session.commit()
            remaining = settings.MAX_LOGIN_ATTEMPTS - admin.login_attempts
            raise HTTPException(status_code=401, detail=f"密码错误，还剩{remaining}次机会")
        
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
            raise HTTPException(status_code=401, detail="原密码错误")
        
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
                    "prediction_mode": v.prediction_mode,
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
        "single": {
            "name": f"Deep V4 PRO (单AI模式)",
            "provider": "deepseek",
            "model": settings.SINGLE_AI_MODEL,
            "api_key_set": bool(settings.SINGLE_AI_API_KEY and len(settings.SINGLE_AI_API_KEY) > 10),
            "role": "单模型直接给出庄/闲预测",
        },
    }
    
    all_keys_set = all(m["api_key_set"] for k, m in models_config.items() if k in ("banker", "player", "combined"))

    return {
        "status": "ready" if all_keys_set else "incomplete",
        "all_api_keys_configured": all_keys_set,
        "models": models_config,
        "smart_router_enabled": True,
        "fallback_policy": "永不降级（铁律：必须满血3模型）",
    }

@router.post("/api-config")
async def update_api_config(
    req: ApiConfigPayload,
    _: dict = Depends(get_current_user),
):
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
    
    # Map role to settings keys
    role_map = {
        "banker": ("OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_API_BASE"),
        "player": ("ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "ANTHROPIC_API_BASE"),
        "combined": ("GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_API_BASE"),
        "single": ("SINGLE_AI_API_KEY", "SINGLE_AI_MODEL", "SINGLE_AI_API_BASE"),
    }
    
    if req.role not in role_map:
        raise HTTPException(status_code=400, detail="Invalid role")
        
    k_key, m_key, b_key = role_map[req.role]
    
    # Update runtime settings
    setattr(settings, k_key, req.api_key)
    os.environ[k_key] = req.api_key
    setattr(settings, m_key, req.model)
    os.environ[m_key] = req.model
    if req.base_url:
        setattr(settings, b_key, req.base_url)
        os.environ[b_key] = req.base_url
        
    # Save to .env
    env_content = ""
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            env_content = f.read()
    
    def set_env_var(content, key, val):
        if not val:
            return content
        lines = content.split('\n')
        updated = False
        for i, line in enumerate(lines):
            if line.startswith(f"{key}="):
                lines[i] = f"{key}={val}"
                updated = True
                break
        if not updated:
            lines.append(f"{key}={val}")
        return '\n'.join(lines)

    env_content = set_env_var(env_content, k_key, req.api_key)
    env_content = set_env_var(env_content, m_key, req.model)
    if req.base_url:
        env_content = set_env_var(env_content, b_key, req.base_url)

    with open(env_path, "w", encoding="utf-8") as f:
        f.write(env_content)

    return {"status": "success", "message": f"{req.role} model updated"}

@router.post("/api-config/test")
async def test_api_config(
    req: ApiConfigPayload,
    _: dict = Depends(get_current_user),
):
    try:
        # Default models for testing based on provider
        if req.provider == "openai":
            from openai import AsyncOpenAI
            import httpx
            client = AsyncOpenAI(
                api_key=req.api_key,
                base_url=req.base_url if req.base_url else None,
                http_client=httpx.AsyncClient(timeout=10.0)
            )
            await client.chat.completions.create(
                model=req.model,
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=5
            )
            return {"success": True, "message": "OpenAI connection successful"}
            
        elif req.provider == "anthropic":
            from anthropic import AsyncAnthropic
            import httpx
            client = AsyncAnthropic(
                api_key=req.api_key,
                base_url=req.base_url if req.base_url else None,
                http_client=httpx.AsyncClient(timeout=10.0)
            )
            await client.messages.create(
                model=req.model,
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=5
            )
            return {"success": True, "message": "Anthropic connection successful"}
            
        elif req.provider == "google":
            import google.generativeai as genai
            genai.configure(api_key=req.api_key)
            model = genai.GenerativeModel(req.model)
            model.generate_content("Hello")
            return {"success": True, "message": "Gemini connection successful"}
            
        elif req.provider == "deepseek":
            from openai import AsyncOpenAI
            import httpx
            client = AsyncOpenAI(
                api_key=req.api_key,
                base_url=req.base_url or "https://api.deepseek.com/v1",
                http_client=httpx.AsyncClient(timeout=10.0)
            )
            await client.chat.completions.create(
                model=req.model,
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=5
            )
            return {"success": True, "message": "Deepseek connection successful"}
            
        else:
            return {"success": False, "message": f"Unknown provider: {req.provider}"}
            
    except Exception as e:
        return {"success": False, "message": str(e)}
