from django.contrib import admin

from .models import Lease, Tenant


@admin.register(Lease)
class LeaseAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "property",
        "tenant_name",
        "start_date",
        "end_date",
        "status",
        "created_at",
    )
    search_fields = ("tenant_name", "tenant_phone", "tenant_email", "property__title")
    list_filter = ("status", "start_date")


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "full_name",
        "phone_number",
        "email",
        "agency",
        "is_active",
        "created_at",
    )
    search_fields = ("full_name", "phone_number", "email", "agency__name")
    list_filter = ("is_active", "created_at")
