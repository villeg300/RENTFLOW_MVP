from rest_framework import serializers

from .models import NotificationLog, TenantNotificationPreference


class NotificationLogSerializer(serializers.ModelSerializer):
    lease_id = serializers.UUIDField(source="lease.id", read_only=True)
    tenant_id = serializers.UUIDField(source="tenant.id", read_only=True)
    property_title = serializers.CharField(
        source="lease.property.title", read_only=True
    )
    tenant_name = serializers.CharField(source="lease.tenant_name", read_only=True)

    class Meta:
        model = NotificationLog
        fields = (
            "id",
            "agency",
            "lease_id",
            "tenant_id",
            "property_title",
            "tenant_name",
            "channel",
            "template_key",
            "scheduled_for",
            "status",
            "message",
            "error_message",
            "sent_at",
            "created_at",
        )
        read_only_fields = fields


class TenantNotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantNotificationPreference
        fields = (
            "allow_email",
            "allow_sms",
            "allow_whatsapp",
            "remind_days",
            "whatsapp_verified",
            "whatsapp_verified_at",
            "updated_at",
        )
        read_only_fields = ("whatsapp_verified", "whatsapp_verified_at", "updated_at")
