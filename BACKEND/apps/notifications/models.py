import uuid

from django.db import models
from django.utils import timezone

from apps.agencies.models import Agency
from apps.leases.models import Lease, Tenant


class NotificationChannel(models.TextChoices):
    EMAIL = "email", "Email"
    SMS = "sms", "SMS"
    WHATSAPP = "whatsapp", "WhatsApp"


class NotificationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SENT = "sent", "Sent"
    FAILED = "failed", "Failed"


class NotificationLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agency = models.ForeignKey(
        Agency, on_delete=models.CASCADE, related_name="notification_logs"
    )
    lease = models.ForeignKey(
        Lease, on_delete=models.CASCADE, related_name="notification_logs"
    )
    tenant = models.ForeignKey(
        Tenant, on_delete=models.SET_NULL, null=True, blank=True, related_name="notification_logs"
    )
    channel = models.CharField(max_length=20, choices=NotificationChannel.choices)
    template_key = models.CharField(max_length=50)
    scheduled_for = models.DateField()
    status = models.CharField(
        max_length=20, choices=NotificationStatus.choices, default=NotificationStatus.PENDING
    )
    message = models.TextField(blank=True)
    error_message = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["lease", "channel", "template_key", "scheduled_for"],
                name="unique_notification_per_lease_channel_day",
            )
        ]

    def __str__(self):
        return f"{self.channel} {self.template_key} - {self.lease}"


class TenantNotificationPreference(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.OneToOneField(
        Tenant, on_delete=models.CASCADE, related_name="notification_preference"
    )
    allow_email = models.BooleanField(default=True)
    allow_sms = models.BooleanField(default=True)
    allow_whatsapp = models.BooleanField(default=True)
    remind_days = models.CharField(max_length=50, blank=True)
    whatsapp_verified = models.BooleanField(default=False)
    whatsapp_verified_at = models.DateTimeField(null=True, blank=True)
    whatsapp_verification_code = models.CharField(max_length=128, blank=True)
    whatsapp_verification_expires_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Tenant Notification Preference"
        verbose_name_plural = "Tenant Notification Preferences"

    def __str__(self):
        return f"Prefs {self.tenant}"
