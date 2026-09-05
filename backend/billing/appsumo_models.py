"""Additive AppSumo records. No payment credentials or plaintext codes in audits."""
import uuid
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class AppSumoOffer(models.Model):
    version = models.CharField(max_length=32, unique=True)
    published = models.BooleanField(default=False)
    terms = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.pk and type(self).objects.filter(pk=self.pk, published=True).exists():
            raise ValidationError("Published offers are immutable. Create a new version.")
        super().save(*args, **kwargs)


class AppSumoTier(models.Model):
    offer = models.ForeignKey(AppSumoOffer, on_delete=models.PROTECT, related_name="tiers")
    tier = models.PositiveSmallIntegerField()
    price_usd = models.DecimalField(max_digits=8, decimal_places=2)
    plan = models.OneToOneField("billing.Plan", on_delete=models.PROTECT)
    limits = models.JSONField(default=dict)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["offer", "tier"], name="appsumo_offer_tier")]
        ordering = ["tier"]

    def save(self, *args, **kwargs):
        if self.offer.published:
            raise ValidationError("Published offer tiers are immutable.")
        super().save(*args, **kwargs)


class AppSumoEntitlement(models.Model):
    organization = models.OneToOneField("common.Organization", on_delete=models.PROTECT, related_name="appsumo_entitlement")
    offer = models.ForeignKey(AppSumoOffer, on_delete=models.PROTECT)
    tier = models.PositiveSmallIntegerField(default=1)
    status = models.CharField(max_length=16, default="active")
    activated_at = models.DateTimeField()
    terms_snapshot = models.JSONField(default=dict)


class AppSumoBatch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    offer = models.ForeignKey(AppSumoOffer, on_delete=models.PROTECT)
    environment = models.CharField(max_length=16, choices=[("test", "Test"), ("production", "Production")])
    active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class AppSumoCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    batch = models.ForeignKey(AppSumoBatch, on_delete=models.PROTECT, related_name="codes")
    digest = models.CharField(max_length=64, unique=True)
    encrypted_code = models.TextField()
    masked_code = models.CharField(max_length=20)
    revoked = models.BooleanField(default=False)
    organization = models.ForeignKey("common.Organization", null=True, blank=True, on_delete=models.PROTECT)
    redeemed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    redeemed_at = models.DateTimeField(null=True, blank=True)


class AppSumoAudit(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=48)
    reference = models.CharField(max_length=128, blank=True)
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Audit records cannot be changed.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Audit records cannot be deleted.")


class AppSumoUsage(models.Model):
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    start = models.DateTimeField()
    end = models.DateTimeField()
    emails_sent = models.PositiveIntegerField(default=0)
    imports = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["organization", "start"], name="appsumo_usage_window")]


class AppSumoSendReservation(models.Model):
    usage = models.ForeignKey(AppSumoUsage, on_delete=models.PROTECT, related_name="reservations")
    key = models.CharField(max_length=128)
    state = models.CharField(max_length=16, default="reserved")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["usage", "key"], name="appsumo_send_key")]


class AppSumoImportReceipt(models.Model):
    organization = models.ForeignKey("common.Organization", on_delete=models.PROTECT)
    key = models.CharField(max_length=128)
    payload_digest = models.CharField(max_length=64)
    result = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["organization", "key"], name="appsumo_import_key")]


class AppSumoSignupChallenge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    digest = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True)


class AppSumoRefundPreview(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    rows = models.JSONField(default=list)
    expires_at = models.DateTimeField()
    committed_at = models.DateTimeField(null=True)
