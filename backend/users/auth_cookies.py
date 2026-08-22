"""Public helpers for issuing and clearing API authentication cookies."""

from django.conf import settings
from django.middleware.csrf import get_token


def set_auth_cookies(request, response, access, refresh=None):
    get_token(request)
    options = {
        "secure": settings.SESSION_COOKIE_SECURE,
        "httponly": True,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "path": "/api/",
    }
    response.set_cookie(settings.AUTH_ACCESS_COOKIE_NAME, access, max_age=5 * 60, **options)
    if refresh:
        response.set_cookie(settings.AUTH_REFRESH_COOKIE_NAME, refresh, max_age=24 * 60 * 60, **options)
    return response


def clear_auth_cookies(response):
    response.delete_cookie(settings.AUTH_ACCESS_COOKIE_NAME, path="/api/", samesite=settings.AUTH_COOKIE_SAMESITE)
    response.delete_cookie(settings.AUTH_REFRESH_COOKIE_NAME, path="/api/", samesite=settings.AUTH_COOKIE_SAMESITE)
    return response
