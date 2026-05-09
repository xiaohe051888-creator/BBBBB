from datetime import datetime, timedelta, UTC

from fastapi import APIRouter, HTTPException
from jose import jwt
from sqlalchemy import select

from app.api.routes.schemas import UserLoginRequest
from app.core.config import settings
from app.core.database import async_session
from app.models.schemas import User


router = APIRouter(prefix="/api/auth", tags=["用户认证"])


@router.post("/login")
async def user_login(req: UserLoginRequest):
    import bcrypt as _bcrypt

    async with async_session() as session:
        stmt = select(User).where(User.username == req.username)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="用户名或密码错误")

        if user.locked_until and user.locked_until > datetime.now():
            raise HTTPException(status_code=403, detail="账户已锁定，请10分钟后重试")

        password_bytes = req.password.encode("utf-8")
        try:
            valid = _bcrypt.checkpw(password_bytes, user.password_hash.encode("utf-8"))
        except Exception:
            valid = False

        if not valid:
            user.login_attempts += 1
            if user.login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
                user.locked_until = datetime.now() + timedelta(minutes=settings.LOGIN_LOCKOUT_MINUTES)
                await session.commit()
                raise HTTPException(status_code=403, detail="连续输错密码5次，账户已锁定10分钟")

            await session.commit()
            remaining = settings.MAX_LOGIN_ATTEMPTS - user.login_attempts
            raise HTTPException(status_code=401, detail=f"密码错误，还剩{remaining}次机会")

        user.login_attempts = 0
        user.locked_until = None
        await session.commit()

        token = jwt.encode(
            {
                "sub": user.username,
                "role": "user",
                "uid": user.id,
                "exp": datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=settings.JWT_EXPIRE_HOURS),
            },
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )

        return {
            "token": token,
            "must_change_password": user.must_change_password,
            "username": user.username,
        }

