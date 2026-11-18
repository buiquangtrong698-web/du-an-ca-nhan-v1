import hashlib
import hmac
from io import BytesIO
import os
import secrets
import time
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError
from pwdlib import PasswordHash
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import AuthSession, Notification, User
from backend.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserRead


router = APIRouter(prefix="/api/auth", tags=["authentication"])
password_hasher = PasswordHash.recommended()
SESSION_COOKIE = "orange_session"
CSRF_COOKIE = "orange_csrf"
SESSION_TTL_DAYS = max(1, int(os.environ.get("SESSION_TTL_DAYS", "7")))
SESSION_MAX_AGE = SESSION_TTL_DAYS * 24 * 60 * 60
COOKIE_SECURE = os.environ.get("AUTH_COOKIE_SECURE", "false").lower() == "true"
MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_AVATAR_PIXELS = 20_000_000
MAX_AVATAR_OUTPUT_BYTES = 256 * 1024


def _token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _process_avatar(image_data: bytes) -> bytes:
    try:
        with Image.open(BytesIO(image_data)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail="Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.",
                )
            if getattr(image, "n_frames", 1) > 1:
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail="Vui lòng chọn ảnh tĩnh.",
                )
            if image.width * image.height > MAX_AVATAR_PIXELS:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Kích thước ảnh quá lớn.",
                )
            image.verify()

        with Image.open(BytesIO(image_data)) as image:
            avatar = ImageOps.exif_transpose(image)
            avatar.thumbnail((256, 256), Image.Resampling.LANCZOS)
            if "A" in avatar.getbands() or "transparency" in avatar.info:
                transparent_avatar = avatar.convert("RGBA")
                avatar = Image.new("RGB", avatar.size, (255, 247, 237))
                avatar.paste(transparent_avatar, mask=transparent_avatar.getchannel("A"))
            else:
                avatar = avatar.convert("RGB")
            output = BytesIO()
            avatar.save(output, format="WEBP", quality=82, method=6)
            processed = output.getvalue()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tệp tải lên không phải ảnh hợp lệ.",
        ) from error

    if len(processed) > MAX_AVATAR_OUTPUT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Ảnh sau khi xử lý vẫn quá lớn.",
        )
    return processed


def _check_csrf(request: Request):
    cookie_token = request.cookies.get(CSRF_COOKIE, "")
    header_token = request.headers.get("X-CSRF-Token", "")
    if not cookie_token or not header_token or not hmac.compare_digest(cookie_token, header_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yêu cầu không hợp lệ.")


def _set_session_cookie(response: Response, raw_token: str):
    response.set_cookie(
        SESSION_COOKIE,
        raw_token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def _start_session(database: Session, user: User, response: Response):
    raw_token = secrets.token_urlsafe(32)
    now = int(time.time())
    database.add(
        AuthSession(
            token_hash=_token_digest(raw_token),
            user_id=user.id,
            created_at=now,
            expires_at=now + SESSION_MAX_AGE,
        )
    )
    database.commit()
    _set_session_cookie(response, raw_token)


def get_optional_current_user(
    request: Request,
    database: Annotated[Session, Depends(get_db)],
) -> User | None:
    raw_token = request.cookies.get(SESSION_COOKIE)
    if not raw_token:
        return None

    session = database.get(AuthSession, _token_digest(raw_token))
    if session is None:
        return None
    if session.expires_at <= int(time.time()):
        database.delete(session)
        database.commit()
        return None
    return database.get(User, session.user_id)


def get_current_user(
    user: Annotated[User | None, Depends(get_optional_current_user)],
) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Vui lòng đăng nhập.")
    return user


@router.get("/csrf")
def issue_csrf_token(response: Response):
    token = secrets.token_urlsafe(32)
    response.set_cookie(
        CSRF_COOKIE,
        token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
    return {"csrf_token": token}


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    database: Annotated[Session, Depends(get_db)],
):
    _check_csrf(request)
    if payload.password != payload.password_confirmation:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Mật khẩu xác nhận không khớp.")

    username = payload.username.lower()
    if database.query(User).filter(func.lower(User.username) == username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tên đăng nhập đã được sử dụng.")

    user = User(
        username=username,
        display_name=payload.display_name.strip() or username,
        password_hash=password_hasher.hash(payload.password),
        role="user",
    )
    database.add(user)
    try:
        database.flush()
        database.add(
            Notification(
                category="Cộng đồng",
                title="Thành viên mới tham gia",
                description=(
                    "Một thành viên mới vừa tham gia Orange Team.\n"
                    f"Tên hiển thị: {user.display_name}\n"
                    f"Tên đăng nhập: {user.username}"
                ),
            )
        )
        _start_session(database, user, response)
    except IntegrityError:
        database.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tên đăng nhập đã được sử dụng.") from None

    return AuthResponse(user=UserRead.model_validate(user))


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    database: Annotated[Session, Depends(get_db)],
):
    _check_csrf(request)
    username = payload.username.lower()
    user = database.query(User).filter(func.lower(User.username) == username).first()
    if user is None or not password_hasher.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tên đăng nhập hoặc mật khẩu không đúng.")

    _start_session(database, user, response)
    return AuthResponse(user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def current_user(
    response: Response,
    user: Annotated[User, Depends(get_current_user)],
):
    response.headers["Cache-Control"] = "no-store"
    return UserRead.model_validate(user)


@router.post("/avatar", response_model=UserRead)
async def upload_avatar(
    request: Request,
    file: Annotated[UploadFile, File()],
    user: Annotated[User, Depends(get_current_user)],
    database: Annotated[Session, Depends(get_db)],
):
    _check_csrf(request)
    image_data = await file.read(MAX_AVATAR_UPLOAD_BYTES + 1)
    if len(image_data) > MAX_AVATAR_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Ảnh tải lên không được vượt quá 5 MB.",
        )

    user.avatar_data = _process_avatar(image_data)
    database.commit()
    database.refresh(user)
    return UserRead.model_validate(user)


@router.get("/avatar")
def get_avatar(
    response: Response,
    user: Annotated[User, Depends(get_current_user)],
):
    if user.avatar_data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tài khoản chưa có avatar.")

    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return Response(content=user.avatar_data, media_type="image/webp", headers=response.headers)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    database: Annotated[Session, Depends(get_db)],
):
    _check_csrf(request)
    raw_token = request.cookies.get(SESSION_COOKIE)
    if raw_token:
        session = database.get(AuthSession, _token_digest(raw_token))
        if session is not None:
            database.delete(session)
            database.commit()
    response.delete_cookie(SESSION_COOKIE, path="/", samesite="lax")
    response.delete_cookie(CSRF_COOKIE, path="/", samesite="lax")
