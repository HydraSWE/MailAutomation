#!/bin/sh
set -e

python manage.py migrate

if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    python manage.py shell -c "import os; from django.contrib.auth import get_user_model; User=get_user_model(); username=os.environ.get('DJANGO_SUPERUSER_USERNAME'); email=os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@example.com'); password=os.environ.get('DJANGO_SUPERUSER_PASSWORD'); u, _=User.objects.get_or_create(username=username, defaults={'email':email, 'role':'owner', 'is_staff':True, 'is_superuser':True}); u.set_password(password); u.is_staff=True; u.is_superuser=True; u.role='owner'; u.organization=None; u.save()"
fi

exec "$@"

