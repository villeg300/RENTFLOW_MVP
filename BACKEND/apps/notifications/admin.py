from django.contrib import admin

from .models import NotificationLog, TenantNotificationPreference


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "agency",
        "lease",
        "channel",
        "template_key",
        "scheduled_for",
        "status",
        "sent_at",
    )
    search_fields = (
        "lease__tenant_name",
        "lease__property__title",
        "message",
        "error_message",
    )
    list_filter = ("channel", "status", "scheduled_for")


@admin.register(TenantNotificationPreference)
class TenantNotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = (
        "tenant",
        "allow_email",
        "allow_sms",
        "allow_whatsapp",
        "updated_at",
    )
    search_fields = ("tenant__full_name", "tenant__phone_number", "tenant__email")
    list_filter = ("allow_email", "allow_sms", "allow_whatsapp")
