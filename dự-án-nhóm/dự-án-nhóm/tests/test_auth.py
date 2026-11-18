import os
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from PIL import Image
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.engine import URL


TEMP_DIRECTORY = tempfile.TemporaryDirectory()
test_database_url = URL.create(
    "sqlite",
    database=str(Path(TEMP_DIRECTORY.name) / "auth-test.db"),
).render_as_string(hide_password=False)
os.environ["DATABASE_URL"] = test_database_url
os.environ["AUTH_COOKIE_SECURE"] = "false"

from fastapi.testclient import TestClient
from pwdlib import PasswordHash

from backend import database as database_module
from backend.database import SessionLocal, engine
from backend.main import app
from backend.models import Notification, User


class AuthenticationFlowTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)

    def _csrf_headers(self):
        response = self.client.get("/api/auth/csrf")
        self.assertEqual(response.status_code, 200)
        return {"X-CSRF-Token": response.json()["csrf_token"]}

    def _register(self, username):
        return self.client.post(
            "/api/auth/register",
            headers=self._csrf_headers(),
            json={
                "username": username,
                "display_name": "Orange Member",
                "password": "a-strong-password",
                "password_confirmation": "a-strong-password",
                "role": "admin",
            },
        )

    def test_guest_is_redirected_from_root_and_existing_pages(self):
        root_response = self.client.get("/", follow_redirects=False)
        page_response = self.client.get("/html/dien-dan/dien-dan.html", follow_redirects=False)
        account_response = self.client.get(
            "/frontend/html/trang-chu.html",
            follow_redirects=False,
        )

        self.assertEqual(root_response.status_code, 302)
        self.assertIn("/frontend/html/dang-nhap.html", root_response.headers["location"])
        self.assertEqual(page_response.status_code, 302)
        self.assertIn("dien-dan", page_response.headers["location"])
        self.assertEqual(account_response.status_code, 302)
        self.assertIn("/frontend/html/dang-nhap.html", account_response.headers["location"])

    def test_javascript_assets_are_not_cached(self):
        for path in ("/js/dien-dan.js", "/js/dien-dan-cap-do.js", "/frontend/js/trang-chu.js"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers["cache-control"], "no-store")

    def test_register_hashes_password_and_returns_account_data(self):
        response = self._register("member_register")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["user"]["display_name"], "Orange Member")
        self.assertEqual(response.json()["user"]["role"], "user")
        account_page = self.client.get("/frontend/html/trang-chu.html")
        self.assertEqual(account_page.status_code, 200)
        self.assertIn("account-display-name", account_page.text)
        self.assertIn('<h1 id="account-display-name">', account_page.text)
        self.assertIn('id="account-avatar-upload"', account_page.text)
        self.assertIn('id="account-avatar-input"', account_page.text)
        self.assertIn("account-role", account_page.text)
        self.assertIn('id="account-post-count"', account_page.text)
        self.assertIn('id="account-like-count"', account_page.text)
        self.assertIn('id="account-level-value"', account_page.text)
        self.assertIn('src="../../js/dien-dan-cap-do.js"', account_page.text)
        self.assertIn("account-achievements", account_page.text)
        self.assertNotIn("account-username", account_page.text)
        self.assertNotIn("account-created-at", account_page.text)
        profile_response = self.client.get("/api/auth/me")
        self.assertEqual(profile_response.status_code, 200)
        self.assertNotIn("password_hash", profile_response.json())
        self.assertEqual(profile_response.headers["cache-control"], "no-store")

        with SessionLocal() as database:
            user = database.query(User).filter_by(username="member_register").one()
            self.assertEqual(user.role, "user")
            self.assertNotEqual(user.password_hash, "a-strong-password")
            self.assertTrue(PasswordHash.recommended().verify("a-strong-password", user.password_hash))

    def test_authenticated_user_can_upload_and_retrieve_avatar(self):
        registration = self._register("avatar_member")
        self.assertEqual(registration.status_code, 201)
        self.assertIsNone(self.client.get("/api/auth/me").json()["avatar_url"])
        self.assertEqual(self.client.get("/api/auth/avatar").status_code, 404)

        image_buffer = BytesIO()
        Image.new("RGB", (32, 32), (240, 120, 40)).save(image_buffer, format="PNG")
        upload_response = self.client.post(
            "/api/auth/avatar",
            headers=self._csrf_headers(),
            files={"file": ("avatar.png", image_buffer.getvalue(), "image/png")},
        )

        self.assertEqual(upload_response.status_code, 200)
        self.assertEqual(upload_response.json()["avatar_url"], "/api/auth/avatar")
        avatar_response = self.client.get("/api/auth/avatar")
        self.assertEqual(avatar_response.status_code, 200)
        self.assertEqual(avatar_response.headers["content-type"], "image/webp")
        self.assertEqual(avatar_response.headers["cache-control"], "no-store")
        self.assertTrue(avatar_response.content.startswith(b"RIFF"))
        self.assertEqual(avatar_response.content[8:12], b"WEBP")

        with SessionLocal() as database:
            user = database.query(User).filter_by(username="avatar_member").one()
            self.assertIsNotNone(user.avatar_data)

    def test_avatar_upload_rejects_unsupported_and_oversized_files(self):
        registration = self._register("invalid_avatar_member")
        self.assertEqual(registration.status_code, 201)

        missing_csrf_response = self.client.post(
            "/api/auth/avatar",
            files={"file": ("avatar.png", b"invalid image", "image/png")},
        )
        self.assertEqual(missing_csrf_response.status_code, 403)

        image_buffer = BytesIO()
        Image.new("RGB", (16, 16), (20, 40, 60)).save(image_buffer, format="GIF")
        unsupported_response = self.client.post(
            "/api/auth/avatar",
            headers=self._csrf_headers(),
            files={"file": ("avatar.gif", image_buffer.getvalue(), "image/gif")},
        )
        self.assertEqual(unsupported_response.status_code, 415)

        oversized_response = self.client.post(
            "/api/auth/avatar",
            headers=self._csrf_headers(),
            files={
                "file": (
                    "avatar.png",
                    b"x" * (5 * 1024 * 1024 + 1),
                    "image/png",
                )
            },
        )
        self.assertEqual(oversized_response.status_code, 413)

    def test_forum_composer_uses_the_logged_in_display_name(self):
        registration = self._register("forum_author")
        self.assertEqual(registration.status_code, 201)

        room_pages = (
            "/html/dien-dan/dien-dan-lien-quan.html",
            "/html/dien-dan/dien-dan-lang-vit.html",
            "/html/dien-dan/dien-dan-mobi.html",
        )
        for path in room_pages:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn("../../frontend/js/auth.js", response.text)
                self.assertIn('id="postContent"', response.text)
                self.assertNotIn('id="postAuthor"', response.text)

    def test_registration_creates_a_shared_member_notification(self):
        registration = self._register("member_notification")
        self.assertEqual(registration.status_code, 201)

        response = self.client.get("/api/notifications")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")
        member_notification = response.json()["items"][0]
        self.assertEqual(member_notification["title"], "Thành viên mới tham gia")
        self.assertIn("Orange Member", member_notification["description"])
        self.assertEqual(member_notification["category"], "Cộng đồng")

        with TestClient(app) as another_client:
            csrf_response = another_client.get("/api/auth/csrf")
            other_registration = another_client.post(
                "/api/auth/register",
                headers={"X-CSRF-Token": csrf_response.json()["csrf_token"]},
                json={
                    "username": "member_notification_viewer",
                    "display_name": "Another Member",
                    "password": "a-strong-password",
                    "password_confirmation": "a-strong-password",
                },
            )
            self.assertEqual(other_registration.status_code, 201)
            shared_notifications = another_client.get("/api/notifications").json()["items"]
            self.assertIn(
                member_notification["id"],
                {item["id"] for item in shared_notifications},
            )

    def test_forum_post_creates_a_shared_notification_with_csrf(self):
        registration = self._register("member_forum_notification")
        self.assertEqual(registration.status_code, 201)
        payload = {
            "room": "DIỄN ĐÀN LIÊN QUÂN",
            "content": "Chia sẻ chiến thuật mới." + (" Mẹo chơi hữu ích." * 70),
            "image_count": 2,
        }

        missing_csrf = self.client.post("/api/notifications/forum-post", json=payload)
        created = self.client.post(
            "/api/notifications/forum-post",
            headers=self._csrf_headers(),
            json=payload,
        )

        self.assertEqual(missing_csrf.status_code, 403)
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["category"], "Diễn đàn")
        self.assertIn("Orange Member", created.json()["description"])
        self.assertIn(payload["content"], created.json()["description"])
        self.assertIn("Số ảnh đính kèm: 2", created.json()["description"])

    def test_only_admin_can_create_a_persistent_notification(self):
        registration = self._register("member_notification_admin")
        self.assertEqual(registration.status_code, 201)
        payload = {
            "title": "Thông báo cần lưu",
            "category": "Sự kiện",
            "description": "Nội dung dài hạn."
        }

        denied = self.client.post(
            "/api/notifications",
            headers=self._csrf_headers(),
            json=payload,
        )
        self.assertEqual(denied.status_code, 403)

        with SessionLocal() as database:
            user = database.query(User).filter_by(username="member_notification_admin").one()
            user.role = "admin"
            database.commit()

        created = self.client.post(
            "/api/notifications",
            headers=self._csrf_headers(),
            json=payload,
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["title"], payload["title"])
        all_notifications = self.client.get("/api/notifications").json()
        self.assertIn(
            created.json()["id"],
            {item["id"] for item in all_notifications["items"]},
        )

    def test_notification_history_uses_pages_without_dropping_old_items(self):
        registration = self._register("member_notification_history")
        self.assertEqual(registration.status_code, 201)

        with SessionLocal() as database:
            records = [
                Notification(
                    category="Kiểm thử",
                    title=f"Thông báo lịch sử {index}",
                    description="Nội dung được lưu lâu dài.",
                )
                for index in range(4)
            ]
            database.add_all(records)
            database.flush()
            inserted_ids = {record.id for record in records}
            database.commit()

        first_page = self.client.get("/api/notifications?limit=2").json()
        self.assertTrue(first_page["has_more"])
        self.assertGreaterEqual(first_page["total_count"], 4)
        self.assertEqual(len(first_page["items"]), 2)

        cursor = first_page["items"][-1]["id"]
        second_page = self.client.get(
            f"/api/notifications?before_id={cursor}&limit=2"
        ).json()
        visible_ids = {
            item["id"] for item in first_page["items"] + second_page["items"]
        }
        self.assertTrue(inserted_ids.issubset(visible_ids))

    def test_notifications_require_login(self):
        response = self.client.get("/api/notifications")

        self.assertEqual(response.status_code, 401)

    def test_login_and_logout_control_protected_account_page(self):
        registration = self._register("member_login")
        self.assertEqual(registration.status_code, 201)
        logout_response = self.client.post(
            "/api/auth/logout",
            headers=self._csrf_headers(),
            json={},
        )
        self.assertEqual(logout_response.status_code, 204)
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

        login_response = self.client.post(
            "/api/auth/login",
            headers=self._csrf_headers(),
            json={"username": "MEMBER_LOGIN", "password": "a-strong-password"},
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.json()["user"]["username"], "member_login")
        self.assertEqual(self.client.get("/api/auth/me").status_code, 200)

    def test_protected_content_pages_are_not_cached(self):
        registration = self._register("member_no_cache")
        self.assertEqual(registration.status_code, 201)

        for page in ("quy-dinh-nhom.html", "thanh-vien-nhom.html", "thong-bao.html"):
            with self.subTest(page=page):
                response = self.client.get(f"/html/{page}")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers["cache-control"], "no-store")
                self.assertIn("../js/admin-permissions.js", response.text)

    def test_registration_requires_csrf_and_matching_passwords(self):
        accented_username_response = self.client.post(
            "/api/auth/register",
            headers=self._csrf_headers(),
            json={
                "username": "thành_viên",
                "display_name": "",
                "password": "a-strong-password",
                "password_confirmation": "a-strong-password",
            },
        )
        no_csrf_response = self.client.post(
            "/api/auth/register",
            json={
                "username": "member_csrf",
                "display_name": "",
                "password": "a-strong-password",
                "password_confirmation": "a-strong-password",
            },
        )
        mismatch_response = self.client.post(
            "/api/auth/register",
            headers=self._csrf_headers(),
            json={
                "username": "member_mismatch",
                "display_name": "",
                "password": "a-strong-password",
                "password_confirmation": "another-password",
            },
        )

        self.assertEqual(accented_username_response.status_code, 422)
        self.assertEqual(no_csrf_response.status_code, 403)
        self.assertEqual(mismatch_response.status_code, 422)

    def test_existing_database_gets_role_column_with_user_default(self):
        legacy_engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
        )
        try:
            with legacy_engine.begin() as connection:
                connection.execute(
                    text(
                        "CREATE TABLE users ("
                        "id INTEGER PRIMARY KEY, "
                        "username VARCHAR(32) NOT NULL, "
                        "display_name VARCHAR(60) NOT NULL, "
                        "password_hash VARCHAR(512) NOT NULL, "
                        "created_at DATETIME NOT NULL)"
                    )
                )
                connection.execute(
                    text(
                        "INSERT INTO users (id, username, display_name, password_hash, created_at) "
                        "VALUES (1, 'existing_user', 'Existing User', 'hash', '2026-01-01')"
                    )
                )

            with patch.object(database_module, "engine", legacy_engine):
                database_module.init_db()

            with legacy_engine.connect() as connection:
                role = connection.execute(
                    text("SELECT role FROM users WHERE username = 'existing_user'")
                ).scalar_one()
            self.assertEqual(role, "user")
            with self.assertRaises(IntegrityError):
                with legacy_engine.begin() as connection:
                    connection.execute(
                        text("UPDATE users SET role = 'superuser' WHERE username = 'existing_user'")
                    )
        finally:
            legacy_engine.dispose()


def tearDownModule():
    engine.dispose()
    TEMP_DIRECTORY.cleanup()


if __name__ == "__main__":
    unittest.main()
