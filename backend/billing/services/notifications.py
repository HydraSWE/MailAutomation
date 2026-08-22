from .common import *  # noqa: F401,F403

def queue_invoice_email(invoice_id):
    from ..tasks import send_invoice_email

    try:
        cast(Any, send_invoice_email).delay(str(invoice_id))
    except Exception:
        pass


def queue_account_created_email(user_id):
    from ..tasks import send_account_created_email

    try:
        cast(Any, send_account_created_email).delay(str(user_id))
    except Exception:
        pass



