from .common import *  # noqa: F401,F403
from .common import _request_user

class SessionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserLoginSessionSerializer
    permission_classes = [OwnerOrAdmin]

    def get_queryset(self):  # pyright: ignore[reportIncompatibleMethodOverride]
        qs = UserLoginSession.objects.select_related("user", "user__organization")
        user = _request_user(self.request)
        return qs if is_owner(user) else qs.filter(user__organization=user.organization)

    @action(detail=True, methods=["post"])
    def revoke(self, request, pk=None):
        session = cast(UserLoginSession, self.get_object())
        session.revoked_at = timezone.now()
        session.save(update_fields=["revoked_at"])
        return Response({"detail": "Session revoked."})

