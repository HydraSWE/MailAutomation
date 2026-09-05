from django.conf import settings
from django.core.checks import Error, register


@register()
def check_appsumo_settings(app_configs, **kwargs):
    if not (settings.APPSUMO_REDEMPTION_ENABLED or settings.APPSUMO_CODE_ADMIN_ENABLED or settings.APPSUMO_OWNER_SMOKE_ENABLED):
        return []
    errors = []
    if len(settings.APPSUMO_CODE_KEY) < 32:
        errors.append(Error("AppSumo requires a persistent APPSUMO_CODE_KEY of at least 32 characters.", id="billing.E020"))
    if not getattr(settings, "FIELD_ENCRYPTION_KEY", ""):
        errors.append(Error("AppSumo requires FIELD_ENCRYPTION_KEY for code exports.", id="billing.E021"))
    return errors
