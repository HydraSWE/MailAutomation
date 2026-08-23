from .models import Notification


def create_broadcast_notifications(broadcast, users):
    from platform_broadcasts.services import build_user_context, render_personalization

    notifications = []
    for user in users:
        context = build_user_context(user, broadcast)
        title = render_personalization(broadcast.subject, context)
        body = render_personalization(broadcast.body, context)
        notifications.append(
            Notification(
                user=user,
                type=Notification.Type.BROADCAST,
                title=title,
                body=body,
                related_broadcast=broadcast,
            )
        )
    if notifications:
        Notification.objects.bulk_create(notifications, ignore_conflicts=True)
