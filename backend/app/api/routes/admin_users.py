from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.routes.schemas import (
    AdminCreateUserRequest,
    AdminUpdateUserRequest,
    AdminUserItem,
)
from app.api.routes.utils import get_current_admin
from app.core.database import async_session
from app.models.schemas import User
from app.services.game.logging import write_game_log


router = APIRouter(prefix="/api/admin/users", tags=["用户管理"])


def _to_item(u: User) -> AdminUserItem:
    return AdminUserItem(
        id=u.id,
        username=u.username,
        is_active=u.is_active,
        must_change_password=u.must_change_password,
        created_at=u.created_at.isoformat() if u.created_at else None,
        updated_at=u.updated_at.isoformat() if u.updated_at else None,
    )


@router.get("")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    q: str | None = Query(None, min_length=1, max_length=64),
    _: dict = Depends(get_current_admin),
):
    async with async_session() as session:
        query = select(User)
        if q:
            query = query.where(User.username.contains(q))

        total = (await session.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
        rows = (
            await session.execute(
                query.order_by(User.id.desc()).offset((page - 1) * page_size).limit(page_size)
            )
        ).scalars().all()

        return {
            "data": [_to_item(u).model_dump() for u in rows],
            "page": page,
            "page_size": page_size,
            "total": int(total),
        }


@router.post("")
async def create_user(req: AdminCreateUserRequest, _: dict = Depends(get_current_admin)):
    import bcrypt as _bcrypt

    username = req.username.strip()
    if not username:
        raise HTTPException(400, "用户名不能为空")

    password_bytes = req.password.encode("utf-8")
    password_hash = _bcrypt.hashpw(password_bytes, _bcrypt.gensalt()).decode("utf-8")

    async with async_session() as session:
        user = User(
            username=username,
            password_hash=password_hash,
            is_active=bool(req.is_active),
            must_change_password=bool(req.must_change_password),
        )
        session.add(user)
        try:
            await session.flush()
        except IntegrityError:
            await session.rollback()
            raise HTTPException(status_code=409, detail="用户名已存在")

        await write_game_log(
            session=session,
            boot_number=0,
            game_number=None,
            event_code="ADMIN-USER-CREATE",
            event_type="用户管理",
            event_result="OK",
            description=f"创建用户 {username}",
            category="用户管理",
            priority="P3",
            source_module="AdminUsersApi",
        )

        await session.commit()
        await session.refresh(user)

        return _to_item(user).model_dump()


@router.patch("/{user_id}")
async def update_user(
    user_id: int,
    req: AdminUpdateUserRequest,
    _: dict = Depends(get_current_admin),
):
    import bcrypt as _bcrypt

    async with async_session() as session:
        user = await session.get(User, user_id)
        if user is None:
            raise HTTPException(404, "用户不存在")

        if req.username is not None:
            new_username = req.username.strip()
            if not new_username:
                raise HTTPException(400, "用户名不能为空")
            user.username = new_username

        if req.password is not None:
            user.password_hash = _bcrypt.hashpw(req.password.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")
            user.must_change_password = True

        if req.is_active is not None:
            user.is_active = bool(req.is_active)

        if req.must_change_password is not None:
            user.must_change_password = bool(req.must_change_password)

        try:
            await session.flush()
        except IntegrityError:
            await session.rollback()
            raise HTTPException(status_code=409, detail="用户名已存在")

        await write_game_log(
            session=session,
            boot_number=0,
            game_number=None,
            event_code="ADMIN-USER-UPDATE",
            event_type="用户管理",
            event_result="OK",
            description=f"更新用户 {user_id}",
            category="用户管理",
            priority="P3",
            source_module="AdminUsersApi",
        )

        await session.commit()
        await session.refresh(user)
        return _to_item(user).model_dump()

