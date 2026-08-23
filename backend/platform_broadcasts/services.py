import re
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import QuerySet
from django.utils.html import escape

from .models import PlatformBroadcast

User = get_user_model()


VALID_ROLES = {"owner", "admin", "manager", "operator", "viewer"}
VALID_ORGANIZATION_STATUSES = {"active", "suspended", "expired"}


def normalize_list(value):
    if not value:
        return []
    if not isinstance(value, list):
        return []
    return [str(item).strip().lower() for item in value if str(item).strip()]


def target_user_queryset(broadcast: PlatformBroadcast) -> QuerySet:
    qs = User.objects.select_related("organization", "organization__subscription", "organization__subscription__plan")
    qs = qs.exclude(email="")
    if broadcast.active_only:
        qs = qs.filter(is_active=True)
    roles = normalize_list(broadcast.target_roles)
    if roles:
        qs = qs.filter(role__in=roles)
    plan_slugs = normalize_list(broadcast.target_plan_slugs)
    if plan_slugs:
        qs = qs.filter(organization__subscription__plan__slug__in=plan_slugs)
    organization_statuses = normalize_list(broadcast.target_organization_statuses)
    if organization_statuses:
        qs = qs.filter(organization__status__in=organization_statuses)
    return qs.order_by("id")


def preview_count(attrs: dict[str, Any], instance: PlatformBroadcast | None = None) -> int:
    broadcast = instance or PlatformBroadcast(subject=attrs.get("subject", "Preview"), body=attrs.get("body", "Preview"))
    for field in ("target_roles", "target_plan_slugs", "target_organization_statuses", "active_only"):
        if field in attrs:
            setattr(broadcast, field, attrs[field])
    return target_user_queryset(broadcast).count()


<<<<<<< HEAD
def render_broadcast_html(subject: str, body: str) -> str:
    from billing.emails import build_html_shell

    lines = [part.strip() for part in body.splitlines() if part.strip()]
=======
def build_user_context(user=None, broadcast: PlatformBroadcast | None = None) -> dict[str, str]:
    if not user:
        return {
            "user_name": "Valued Member",
            "name": "Valued Member",
            "first_name": "Member",
            "username": "member",
            "email": "",
            "user_email": "",
            "organization_name": "Platform Workspace",
            "org_name": "Platform Workspace",
            "company": "Platform Workspace",
            "organization": "Platform Workspace",
            "plan_name": "Standard",
            "plan": "Standard",
            "support_email": "support@annomous.com",
            "role": "Member",
        }

    org = getattr(user, "organization", None)
    org_name = org.name if org else "Platform Workspace"

    plan_name = "Standard"
    if org:
        sub = getattr(org, "subscription", None)
        if sub and getattr(sub, "plan", None):
            plan_name = sub.plan.name

    user_name = getattr(user, "name", None) or getattr(user, "first_name", None) or getattr(user, "username", "Valued Member")
    user_email = getattr(user, "email", "") or ""

    raw_support = (
        getattr(settings, "MAIL_FLOW_SUPPORT_EMAIL", None)
        or getattr(settings, "SUPPORT_EMAIL", None)
        or "support@annomous.com"
    )
    if "<" in raw_support and ">" in raw_support:
        support_email = raw_support.split("<")[1].split(">")[0].strip()
    else:
        support_email = raw_support.strip()

    role_val = getattr(user, "role", "") or "member"
    role_display = role_val.capitalize()

    return {
        "user_name": user_name,
        "name": user_name,
        "first_name": getattr(user, "first_name", "") or user_name,
        "username": getattr(user, "username", user_name),
        "user_email": user_email,
        "email": user_email,
        "organization_name": org_name,
        "org_name": org_name,
        "company": org_name,
        "organization": org_name,
        "plan_name": plan_name,
        "plan": plan_name,
        "support_email": support_email,
        "role": role_display,
    }


def render_personalization(value: str, context: dict[str, Any]) -> str:
    if not value:
        return ""

    ctx = {str(k).strip().lower(): (v if v is not None else "") for k, v in context.items()}
    pattern = re.compile(r'\{\{?\s*([a-zA-Z0-9_]+)\s*\}?\}')

    def _replacer(match):
        var_name = match.group(1).strip().lower()
        if var_name in ctx:
            return str(ctx[var_name])
        return match.group(0)

    return pattern.sub(_replacer, str(value))


def render_broadcast_html(subject: str, body: str, user=None, broadcast=None) -> str:
    from billing.emails import build_html_shell

    context = build_user_context(user, broadcast)
    rendered_subject = render_personalization(subject, context)
    rendered_body = render_personalization(body, context)

    lines = [part.strip() for part in rendered_body.splitlines() if part.strip()]
>>>>>>> 0044d19 (polish_full)
    intro = lines[0] if lines else "A platform update is available."
    remaining = lines[1:] if len(lines) > 1 else []

    custom_content = ""
    if remaining:
        paragraphs_html = "".join(
            f'<p style="font-size:14px;line-height:1.6;color:#94A3B8;margin:0 0 14px;">{escape(p)}</p>'
            for p in remaining
        )
        custom_content = f'<div style="margin-top:12px;">{paragraphs_html}</div>'

    return build_html_shell(
<<<<<<< HEAD
        title=subject,
=======
        title=rendered_subject,
>>>>>>> 0044d19 (polish_full)
        intro=intro,
        custom_content=custom_content,
        badge="Platform Announcement",
        footer_note="You received this platform announcement as a registered user of Mail Flow.",
        template_name="emails/billing/base.html",
    )

