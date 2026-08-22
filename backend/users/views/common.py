from typing import cast

import uuid
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from ..auth_cookies import clear_auth_cookies as _clear_auth_cookies
from ..auth_cookies import set_auth_cookies as _set_auth_cookies
from common.models import SystemSetting
from common.permissions import OwnerOrAdmin
from common.tenancy import is_owner, scope_queryset
from common.utils import get_client_ip
from ..models import User, UserLoginSession
from ..serializers import (
    CustomTokenObtainPairSerializer,
    ProfileSerializer,
    SessionTokenRefreshSerializer,
    SystemSettingSerializer,
    UserLoginSessionSerializer,
    UserSerializer,
)
from ..two_factor import (
    create_challenge_token,
    generate_backup_codes,
    generate_qr_code_base64,
    generate_totp_secret,
    get_totp_uri,
    verify_and_consume_backup_code,
    verify_challenge_token,
    verify_totp,
)


def _request_user(request) -> User:
    return cast(User, request.user)


def _is_last_active_admin(user):
    """Return True if *user* is the only active admin in their organization."""
    if user.role != User.Role.ADMIN or not user.organization:
        return False
    return not (
        User.objects.filter(
            organization=user.organization,
            role=User.Role.ADMIN,
            is_active=True,
        )
        .exclude(pk=user.pk)
        .exists()
    )


__all__ = [name for name in globals() if not name.startswith('__')]

