from django.http import HttpRequest, HttpResponse
from django.test import SimpleTestCase, override_settings

from users.auth_cookies import clear_auth_cookies, set_auth_cookies


@override_settings(
    SESSION_COOKIE_SECURE=True,
    AUTH_COOKIE_SAMESITE="Lax",
    AUTH_ACCESS_COOKIE_NAME="access_token",
    AUTH_REFRESH_COOKIE_NAME="refresh_token",
)
class AuthCookieTests(SimpleTestCase):
    def test_set_auth_cookies_preserves_scope_and_lifetimes(self):
        response = set_auth_cookies(HttpRequest(), HttpResponse(), "access", "refresh")
        self.assertEqual(response.cookies["access_token"]["path"], "/api/")
        self.assertEqual(response.cookies["access_token"]["max-age"], 300)
        self.assertEqual(response.cookies["refresh_token"]["max-age"], 86400)
        self.assertTrue(response.cookies["access_token"]["httponly"])

    def test_clear_auth_cookies_uses_original_path(self):
        response = clear_auth_cookies(HttpResponse())
        self.assertEqual(response.cookies["access_token"]["path"], "/api/")
        self.assertEqual(response.cookies["access_token"]["max-age"], 0)
