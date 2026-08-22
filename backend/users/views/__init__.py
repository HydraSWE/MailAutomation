"""Stable public view API assembled from focused user-domain modules."""

from .authentication import CustomTokenObtainPairView, CustomTokenRefreshView, LogoutView
from .management import UserViewSet
from .profile import ChangePasswordView, ProfileView, SettingsView
from .sessions import SessionViewSet
from .two_factor import (
    TwoFactorBackupCodesView,
    TwoFactorConfirmView,
    TwoFactorDisableView,
    TwoFactorSetupView,
    TwoFactorVerifyLoginView,
)

__all__ = [name for name in globals() if name.endswith(("View", "ViewSet"))]
