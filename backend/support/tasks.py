import logging
from celery import shared_task
from .models import SupportMailbox
from .services import sync_mailbox

logger = logging.getLogger(__name__)


@shared_task(name="support.sync_all_active_support_mailboxes")
def sync_all_active_support_mailboxes():
    """
    Periodically called by Celery Beat (e.g. every 60s) to continuously
    import incoming customer replies from all active IMAP support mailboxes.
    """
    active_mailboxes = SupportMailbox.objects.filter(is_active=True)
    results = {"total": active_mailboxes.count(), "synced": 0, "errors": 0}

    for mailbox in active_mailboxes:
        try:
            res = sync_mailbox(mailbox)
            results["synced"] += res.get("imported", 0)
        except Exception as exc:
            results["errors"] += 1
            logger.warning(
                "Automated sync failed for support mailbox %s (%s): %s",
                mailbox.id,
                mailbox.email,
                exc,
            )

    return results
