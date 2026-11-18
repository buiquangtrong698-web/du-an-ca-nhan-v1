from pathlib import Path
from typing import Annotated
from urllib.parse import quote

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse, RedirectResponse

from backend.database import init_db
from backend.models import User
from backend.routers.auth import get_optional_current_user, router as auth_router
from backend.routers.notifications import router as notifications_router


PROJECT_DIR = Path(__file__).resolve().parent.parent
SITE_HTML_DIR = PROJECT_DIR / "html"
FRONTEND_HTML_DIR = PROJECT_DIR / "frontend" / "html"

app = FastAPI(title="Orange Team")
app.include_router(auth_router)
app.include_router(notifications_router)

app.mount("/css", StaticFiles(directory=PROJECT_DIR / "css"), name="site-css")
app.mount("/js", StaticFiles(directory=PROJECT_DIR / "js"), name="site-js")
app.mount("/Images", StaticFiles(directory=PROJECT_DIR / "Images"), name="site-images")
app.mount("/frontend/css", StaticFiles(directory=PROJECT_DIR / "frontend" / "css"), name="frontend-css")
app.mount("/frontend/js", StaticFiles(directory=PROJECT_DIR / "frontend" / "js"), name="frontend-js")


@app.middleware("http")
async def disable_javascript_caching(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith(("/js/", "/frontend/js/")) and request.url.path.endswith(".js"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.on_event("startup")
def on_startup():
    init_db()


def _login_redirect(next_path: str):
    return RedirectResponse(
        f"/frontend/html/dang-nhap.html?next={quote(next_path, safe='')}",
        status_code=302,
    )


@app.get("/")
def home(user: Annotated[User | None, Depends(get_optional_current_user)]):
    if user is None:
        return _login_redirect("/")
    return RedirectResponse("/html/trang-chu.html", status_code=302)


@app.get("/frontend/html/dang-nhap.html")
def login_page(user: Annotated[User | None, Depends(get_optional_current_user)]):
    if user is not None:
        return RedirectResponse("/html/trang-chu.html", status_code=302)
    return FileResponse(FRONTEND_HTML_DIR / "dang-nhap.html")


@app.get("/frontend/html/dang-ky.html")
def register_page(user: Annotated[User | None, Depends(get_optional_current_user)]):
    if user is not None:
        return RedirectResponse("/html/trang-chu.html", status_code=302)
    return FileResponse(FRONTEND_HTML_DIR / "dang-ky.html")


@app.get("/frontend/html/trang-chu.html")
def account_page(
    user: Annotated[User | None, Depends(get_optional_current_user)],
):
    if user is None:
        return _login_redirect("/frontend/html/trang-chu.html")
    return FileResponse(FRONTEND_HTML_DIR / "trang-chu.html", headers={"Cache-Control": "no-store"})


@app.get("/html/{page_path:path}")
def protected_site_page(
    page_path: str,
    request: Request,
    user: Annotated[User | None, Depends(get_optional_current_user)],
):
    if user is None:
        return _login_redirect(str(request.url.path))

    requested_page = (SITE_HTML_DIR / page_path).resolve()
    if SITE_HTML_DIR.resolve() not in requested_page.parents or not requested_page.is_file():
        raise HTTPException(status_code=404, detail="Không tìm thấy trang.")
    if requested_page.suffix.lower() != ".html":
        raise HTTPException(status_code=404, detail="Không tìm thấy trang.")
    return FileResponse(requested_page, headers={"Cache-Control": "no-store"})
