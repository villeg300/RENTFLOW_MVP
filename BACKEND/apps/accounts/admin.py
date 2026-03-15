from django.contrib import admin

from .models import AuditLog, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "phone_number", "email", "full_name", "is_active", "is_staff")
    search_fields = ("phone_number", "email", "full_name")
    list_filter = ("is_active", "is_staff")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "action", "user", "ip_address", "created_at")
    search_fields = ("action", "user__email", "user__phone_number")
    list_filter = ("action", "created_at")
