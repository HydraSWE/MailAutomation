from django.db import migrations


def seed(apps, schema_editor):
    Offer = apps.get_model("billing", "AppSumoOffer")
    Tier = apps.get_model("billing", "AppSumoTier")
    Plan = apps.get_model("billing", "Plan")
    offer = Offer.objects.create(version="2026-v1", published=True, terms={
        "code_price_usd": 69, "maximum_codes": 5, "period_days": 30,
        "rollover": False, "code_expiry": None, "workspaces": 1,
        "device_limit_per_seat": 2, "campaigns_per_day": 10, "push_batch_limit": 250,
        "mail_workspace": True, "mailbox_allowance": "SMTP and inbox connections combined",
        "external_costs": "Customers supply and pay for their mailboxes, domains, and sending providers.",
        "support": "Lifetime updates and support for included capabilities.",
    })
    for i, values in enumerate(zip([5000,10000,20000,35000,50000], [2500,5000,10000,20000,30000], [2,4,6,8,10], [1,2,3,5,8], [1000,2500,5000,7500,10000]), 1):
        emails, contacts, mailboxes, seats, imports = values
        plan = Plan.objects.create(slug=f"appsumo-lifetime-{i}", name=f"AppSumo Lifetime Tier {i}", channel="appsumo",
            email_limit=emails, max_recipients=contacts, max_smtp_accounts=mailboxes, max_users=seats,
            max_admins=seats, daily_email_limit=0, weekly_email_limit=0, max_campaigns_per_day=10,
            support_workspace_enabled=True, is_free=False, is_active=True)
        Tier.objects.create(offer=offer, tier=i, price_usd=69*i, plan=plan,
            limits={"emails": emails, "contacts": contacts, "mailboxes": mailboxes, "seats": seats, "imports": imports})


class Migration(migrations.Migration):
    dependencies = [("billing", "0016_appsumobatch_appsumooffer_appsumosignupchallenge_and_more")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
