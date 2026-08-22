from .common import *  # noqa: F401,F403
from .common import _is_last_active_admin, _request_user

class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [OwnerOrAdmin]
    search_fields = ("username", "email", "name")
    filterset_fields = ("organization", "role", "is_active")

    def get_queryset(self):  # pyright: ignore[reportIncompatibleMethodOverride]
        queryset = User.objects.select_related("organization").order_by("-date_joined")
        org_id = self.request.query_params.get("organization")
        if is_owner(_request_user(self.request)) and org_id:
            queryset = queryset.filter(organization_id=org_id)
        return scope_queryset(queryset, _request_user(self.request))

    def perform_create(self, serializer):
        actor = _request_user(self.request)
        role = serializer.validated_data.get("role", User.Role.OPERATOR)
        # Nobody can create an owner through the product API
        if role == User.Role.OWNER:
            raise ValidationError({"role": "Cannot create an owner through the API."})
        # Admin can only create users in their own organization
        if actor.role == User.Role.ADMIN:
            serializer.validated_data["organization"] = actor.organization
        serializer.save()

    def perform_update(self, serializer):
        actor = _request_user(self.request)
        instance = serializer.instance
        new_role = serializer.validated_data.get("role", instance.role)

        # Cannot edit an owner
        if instance.role == User.Role.OWNER:
            raise ValidationError({"detail": "Cannot modify the owner account."})
        # Cannot assign owner role
        if new_role == User.Role.OWNER:
            raise ValidationError({"role": "Cannot assign the owner role."})
        # Cannot demote yourself
        if instance.pk == actor.pk and new_role != instance.role:
            raise ValidationError({"role": "You cannot change your own role."})
        # Cannot demote the last active admin
        if (
            instance.role == User.Role.ADMIN
            and new_role != User.Role.ADMIN
            and _is_last_active_admin(instance)
        ):
            raise ValidationError(
                {"role": "Cannot demote the last active administrator."}
            )
        serializer.save()

    def perform_destroy(self, instance):
        actor = _request_user(self.request)
        if instance.pk == actor.pk:
            raise ValidationError({"detail": "You cannot delete your own account."})
        if instance.role == User.Role.OWNER:
            raise ValidationError({"detail": "Cannot delete the owner account."})
        if _is_last_active_admin(instance):
            raise ValidationError(
                {"detail": "Cannot delete the last active administrator."}
            )
        instance.delete()

    # ── Custom actions ────────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="set-password")
    def set_password(self, request, pk=None):
        """Admin/owner sets a temporary password for another user."""
        target = cast(User, self.get_object())
        actor = _request_user(request)
        if target.role == User.Role.OWNER and actor.pk != target.pk:
            return Response(
                {"detail": "Cannot reset the owner's password."},
                status=status.HTTP_403_FORBIDDEN,
            )
        password = request.data.get("password", "")
        if not password:
            return Response(
                {"detail": "Password is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_password(password, user=target)
        except DjangoValidationError as exc:
            return Response(
                {"detail": list(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        target.set_password(password)
        target.save(update_fields=["password"])
        # Revoke all active sessions for this user
        UserLoginSession.objects.filter(
            user=target, revoked_at__isnull=True
        ).update(revoked_at=timezone.now())
        return Response({"detail": "Password updated and sessions revoked."})

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        target = cast(User, self.get_object())
        actor = _request_user(request)
        if target.pk == actor.pk:
            return Response(
                {"detail": "You cannot deactivate your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if target.role == User.Role.OWNER:
            return Response(
                {"detail": "Cannot deactivate the owner account."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if _is_last_active_admin(target):
            return Response(
                {"detail": "Cannot deactivate the last active administrator."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        target.is_active = False
        target.save(update_fields=["is_active"])
        # Also revoke sessions
        UserLoginSession.objects.filter(
            user=target, revoked_at__isnull=True
        ).update(revoked_at=timezone.now())
        return Response({"detail": "User deactivated."})

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        target = cast(User, self.get_object())
        target.is_active = True
        target.save(update_fields=["is_active"])
        return Response({"detail": "User reactivated."})

    @action(detail=True, methods=["post"], url_path="revoke-sessions")
    def revoke_sessions(self, request, pk=None):
        target = cast(User, self.get_object())
        count = UserLoginSession.objects.filter(
            user=target, revoked_at__isnull=True
        ).update(revoked_at=timezone.now())
        return Response({"detail": f"{count} session(s) revoked."})

    @action(detail=True, methods=["post"], url_path="reset-2fa")
    def reset_2fa(self, request, pk=None):
        """Admin/Owner resets another user's 2FA."""
        target = cast(User, self.get_object())
        actor = _request_user(request)
        if target.role == User.Role.OWNER:
            return Response(
                {"detail": "Cannot reset 2FA for the owner account."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if target.pk == actor.pk:
            return Response(
                {"detail": "Use your profile settings to manage your own 2FA."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        target.two_factor_enabled = False
        target.two_factor_secret = ""
        target.two_factor_backup_codes = []
        target.save(update_fields=["two_factor_enabled", "two_factor_secret", "two_factor_backup_codes"])
        return Response({"detail": f"2FA has been reset for {target.email}."})


