"""
认证相关路由
"""
import bcrypt as _bcrypt
from datetime import datetime, timedelta, UTC
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, desc

from app.core.database import async_session
from app.models.schemas import AdminUser, ModelVersion, AiModelConfig
from app.core.config import settings
from jose import jwt
import os
from app.services.ai_config_status import compute_config_hash

from app.api.routes.schemas import LoginRequest, ChangePasswordRequest, ApiConfigPayload
from app.api.routes.utils import get_current_user

router = APIRouter(prefix="/api/admin", tags=["认证"])

def resolve_api_key_for_role(role: str, api_key: str) -> str:
    role_map = {
        "banker": "OPENAI_API_KEY",
        "player": "ANTHROPIC_API_KEY",
        "combined": "GEMINI_API_KEY",
        "single": "SINGLE_AI_API_KEY",
    }
    if api_key:
        return api_key
    key = role_map.get(role)
    return (getattr(settings, key, "") or "") if key else ""


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
            {"sub": admin.username, "exp": datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=settings.JWT_EXPIRE_HOURS)},
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
    role_map = {
        "banker": ("OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_API_BASE"),
        "player": ("ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "ANTHROPIC_API_BASE"),
        "combined": ("GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_API_BASE"),
        "single": ("SINGLE_AI_API_KEY", "SINGLE_AI_MODEL", "SINGLE_AI_API_BASE"),
    }

    async with async_session() as session:
        rows = (await session.execute(select(AiModelConfig))).scalars().all()
        by_role = {r.role: r for r in rows if getattr(r, "role", None)}

    def _enabled(v: str | None, min_len: int = 10) -> bool:
        return bool(v and isinstance(v, str) and len(v) > min_len)

    def _get_setting(key: str) -> str:
        return getattr(settings, key, "") or ""

    def _current_hash(role: str, provider: str) -> str:
        k_key, m_key, b_key = role_map[role]
        return compute_config_hash(provider, _get_setting(m_key), _get_setting(k_key), _get_setting(b_key) or None)

    models_config = {
        "banker": {
            "name": "OpenAI GPT-4o mini (庄模型)",
            "provider": (by_role.get("banker").provider if by_role.get("banker") else "openai"),
            "model": settings.OPENAI_MODEL,
            "api_key_set": bool(settings.OPENAI_API_KEY and len(settings.OPENAI_API_KEY) > 10),
            "role": "收集庄向证据链",
        },
        "player": {
            "name": f"Anthropic {settings.ANTHROPIC_MODEL} (闲模型)",
            "provider": (by_role.get("player").provider if by_role.get("player") else "anthropic"),
            "model": settings.ANTHROPIC_MODEL,
            "api_key_set": bool(settings.ANTHROPIC_API_KEY and len(settings.ANTHROPIC_API_KEY) > 10),
            "role": "收集闲向证据链",
        },
        "combined": {
            "name": f"Google {settings.GEMINI_MODEL} (综合模型)",
            "provider": (by_role.get("combined").provider if by_role.get("combined") else "google"),
            "model": settings.GEMINI_MODEL,
            "api_key_set": bool(settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 10),
            "role": "综合分析并给出最终预测",
        },
        "single": {
            "name": f"DeepSeek V4 Pro (单AI模式)",
            "provider": (by_role.get("single").provider if by_role.get("single") else "deepseek"),
            "model": settings.SINGLE_AI_MODEL,
            "api_key_set": bool(settings.SINGLE_AI_API_KEY and len(settings.SINGLE_AI_API_KEY) > 10),
            "role": "单模型直接给出庄/闲预测",
        },
    }

    for role, m in models_config.items():
        row = by_role.get(role)
        current_hash = _current_hash(role, m["provider"])
        last_ok = bool(row and row.last_test_ok and row.last_test_config_hash == current_hash)
        m["last_test_ok"] = last_ok
        m["last_test_at"] = row.last_test_at.isoformat() if row and row.last_test_at else None
        m["last_test_error"] = row.last_test_error if row and row.last_test_error else None

    all_keys_set = all(m["api_key_set"] for k, m in models_config.items() if k in ("banker", "player", "combined"))
    ai_ready_for_enable = all(models_config[k]["api_key_set"] and models_config[k]["last_test_ok"] for k in ("banker", "player", "combined"))
    single_ai_ready_for_enable = bool(models_config["single"]["api_key_set"] and models_config["single"]["last_test_ok"])

    return {
        "status": "ready" if all_keys_set else "incomplete",
        "all_api_keys_configured": all_keys_set,
        "ai_ready_for_enable": ai_ready_for_enable,
        "single_ai_ready_for_enable": single_ai_ready_for_enable,
        "models": models_config,
        "smart_router_enabled": True,
        "fallback_policy": "永不降级（铁律：必须满血3模型）",
    }

@router.post("/api-config")
async def update_api_config(
    req: ApiConfigPayload,
    _: dict = Depends(get_current_user),
):
    from app.core.env_migration import get_env_paths

    env_path, _ = get_env_paths()
    
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
    
    effective_api_key = req.api_key or (getattr(settings, k_key, "") or "")
    effective_model = req.model
    effective_base_url = req.base_url or (getattr(settings, b_key, "") or "")

    if req.api_key:
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

    if req.api_key:
        env_content = set_env_var(env_content, k_key, req.api_key)
    env_content = set_env_var(env_content, m_key, req.model)
    if req.base_url:
        env_content = set_env_var(env_content, b_key, req.base_url)

    with open(env_path, "w", encoding="utf-8") as f:
        f.write(env_content)

    new_hash = compute_config_hash(req.provider, effective_model, effective_api_key, effective_base_url or None)
    async with async_session() as session:
        existing = await session.get(AiModelConfig, req.role)
        if existing is None:
            session.add(
                AiModelConfig(
                    role=req.role,
                    provider=req.provider,
                    model=effective_model,
                    base_url=effective_base_url,
                    config_hash=new_hash,
                    last_test_ok=False,
                    last_test_at=None,
                    last_test_error=None,
                    last_test_config_hash=None,
                )
            )
        else:
            changed = existing.config_hash != new_hash
            existing.provider = req.provider
            existing.model = effective_model
            existing.base_url = effective_base_url
            existing.config_hash = new_hash
            if changed:
                existing.last_test_ok = False
                existing.last_test_at = None
                existing.last_test_error = None
                existing.last_test_config_hash = None
        await session.commit()

    return {"status": "success", "message": "接口配置已保存"}

@router.post("/api-config/test")
async def test_api_config(
    req: ApiConfigPayload,
    _: dict = Depends(get_current_user),
):
    test_ok = False
    message = ""
    try:
        import re as _re
        try:
            import httpx
        except Exception:
            raise Exception("服务端缺少网络请求依赖（httpx），无法进行接口测试")

        effective_api_key = resolve_api_key_for_role(req.role, req.api_key)
        if not effective_api_key:
            raise Exception("未填写接口密钥，且系统未保存过密钥")

        def _cn_error(raw: str) -> str:
            if not raw:
                return "接口调用失败，请检查网络/代理/接口地址"
            s = raw.strip()
            lower = s.lower()
            if _re.search(r"\b401\b", s) or "invalid_api_key" in lower or "incorrect api key" in lower or "unauthorized" in lower:
                return "密钥无效或无权限（401）"
            if _re.search(r"\b403\b", s):
                return "拒绝访问（403），请检查账号权限或接口侧是否限制访问"
            if _re.search(r"\b404\b", s):
                return "接口地址不正确（404），请检查接口地址是否需要 /v1"
            if "rate limit" in s.lower() or "429" in s:
                return "触发限流（429），请稍后重试"
            if "quota" in s.lower() or "insufficient" in s.lower():
                return "额度不足或账户余额不足"
            if _re.search(r"\b400\b", s) or "bad request" in lower:
                return "请求参数错误（400），请重点检查模型名称是否正确"
            if "model" in s.lower() and "not" in s.lower() and "found" in s.lower():
                return "模型不存在或无权限使用该模型"
            if "timed out" in s.lower() or "timeout" in s.lower():
                return "请求超时，请检查网络或接口地址"
            if "name or service not known" in s.lower() or "nodename nor servname provided" in s.lower():
                return "域名解析失败，请检查接口地址"
            if "connection refused" in s.lower():
                return "连接被拒绝，请检查接口地址或代理是否可用"
            if "no module named" in s.lower():
                return "服务端缺少依赖，已切换为直连测试方式仍失败"
            return "接口调用失败，请检查接口密钥/模型/接口地址"

        async def _openai_compatible(base_url: str, api_key: str, model: str) -> None:
            if not base_url:
                raise Exception("缺少接口地址")
            url = base_url.rstrip("/")
            if not url.endswith("/v1") and "/chat/completions" not in url:
                url = f"{url}/v1"
            if not url.endswith("/chat/completions"):
                url = f"{url}/chat/completions"
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": "Hello"}],
                "max_tokens": 5,
                "temperature": 0.2,
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                if resp.status_code != 200:
                    raise Exception(f"上游接口返回错误（{resp.status_code}）")
                data = resp.json()
                _ = data.get("choices", [{}])[0].get("message", {}).get("content")

        async def _anthropic(base_url: str, api_key: str, model: str) -> None:
            if not base_url:
                raise Exception("缺少接口地址")
            url = base_url.rstrip("/")
            if not url.endswith("/messages"):
                url = f"{url}/messages"
            payload = {
                "model": model,
                "max_tokens": 5,
                "messages": [{"role": "user", "content": "Hello"}],
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    url,
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                if resp.status_code != 200:
                    raise Exception(f"上游接口返回错误（{resp.status_code}）")
                data = resp.json()
                _ = data.get("content")

        provider = (req.provider or "").lower()
        base_url = (req.base_url or "").strip()
        if provider == "deepseek" and not base_url:
            base_url = "https://api.deepseek.com"
        if provider == "openai" and not base_url:
            base_url = "https://api.openai.com"
        if provider == "aliyun" and not base_url:
            base_url = "https://dashscope.aliyuncs.com/compatible-mode"
        if provider == "custom" and not base_url:
            raise Exception("自定义兼容接口必须填写接口地址")

        if provider in ("openai", "deepseek", "aliyun", "custom"):
            await _openai_compatible(base_url, effective_api_key, req.model)
            test_ok = True
            message = "接口连接正常"
        elif provider == "anthropic":
            await _anthropic(base_url, effective_api_key, req.model)
            test_ok = True
            message = "接口连接正常"
        else:
            test_ok = False
            message = "未知的服务商类型"
    except Exception as e:
        test_ok = False
        message = _cn_error(str(e))

    cfg_hash = compute_config_hash(req.provider, req.model, req.api_key, req.base_url)
    async with async_session() as session:
        row = await session.get(AiModelConfig, req.role)
        if row is None:
            row = AiModelConfig(
                role=req.role,
                provider=req.provider,
                model=req.model,
                base_url=req.base_url,
                config_hash=cfg_hash,
                last_test_ok=False,
                last_test_at=None,
                last_test_error=None,
                last_test_config_hash=None,
            )
            session.add(row)
        else:
            row.provider = req.provider
            row.model = req.model
            row.base_url = req.base_url
            row.config_hash = cfg_hash

        row.last_test_ok = bool(test_ok)
        row.last_test_at = datetime.now(UTC).replace(tzinfo=None)
        row.last_test_error = None if test_ok else (message[:500] if message else "测试失败")
        row.last_test_config_hash = cfg_hash if test_ok else None
        await session.commit()

    return {"success": bool(test_ok), "message": message}
