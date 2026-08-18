import sys
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent / 'backend'
sys.path.insert(0, str(BASE_DIR))

import os
import django
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ.setdefault('DATABASE_URL', f"sqlite:///{(BASE_DIR / 'db.sqlite3').as_posix()}")

django.setup()

# Apply migrations to ensure tables exist
from django.core.management import call_command
call_command('migrate', '--noinput')

from recipients.models import RecipientList, Recipient

from templates_app.models import EmailTemplate
from smtp_manager.models import SMTPAccount
from campaigns.models import Campaign
from campaigns.tasks import launch_campaign

# Create a demo recipient list
rl, _ = RecipientList.objects.get_or_create(list_name='Demo List')

# Create a demo recipient
rec, _ = Recipient.objects.get_or_create(
    email='demo@example.com',
    recipient_list=rl,
    defaults={
        'name': 'Demo User',
        'company': 'DemoCorp',
        'status': Recipient.Status.ACTIVE,
    },
)

# Create a demo email template
tpl, _ = EmailTemplate.objects.get_or_create(
    title='Demo Template',
    defaults={
        'subject': 'Hello {name}',
        'html': '<p>Hello {name}, this is a test email from the demo campaign.</p>',
    },
)

# Create a demo SMTP account (using localhost for testing)
smtp, _ = SMTPAccount.objects.get_or_create(
    name='Demo SMTP',
    defaults={
        'host': 'localhost',
        'port': 1025,
        'username': '',
        'encrypted_password': '',
        'encryption': SMTPAccount.Encryption.NONE,
        'from_email': 'no-reply@example.com',
        'daily_limit': 1000,
        'status': True,
    },
)

# Create the campaign
campaign, created = Campaign.objects.get_or_create(
    name='Demo Campaign',
    defaults={
        'subject': 'Demo Campaign Subject',
        'template': tpl,
        'recipient_list': rl,
        'smtp': smtp,
        'status': Campaign.Status.DRAFT,
    },
)

# Schedule and launch the campaign immediately
campaign.status = Campaign.Status.SCHEDULED
campaign.scheduled_at = timezone.now()
campaign.save(update_fields=['status', 'scheduled_at'])

# Trigger the launch task (try Celery first, fall back to direct call)
try:
    launch_campaign.delay(campaign.id)
    print('Demo campaign queued via Celery with ID:', campaign.id)
except Exception as e:
    print(f'Celery unavailable ({e}), running task directly...')
    launch_campaign(campaign.id)
    print('Demo campaign executed directly with ID:', campaign.id)
