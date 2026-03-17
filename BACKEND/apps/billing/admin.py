from django.contrib import admin

from .models import AgencyInvoice, AgencySubscription, Plan


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "price_monthly", "price_yearly", "currency", "is_active")
    list_filter = ("is_active", "currency")
    search_fields = ("name", "code")


@admin.register(AgencySubscription)
class AgencySubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        "agency",
        "plan",
        "status",
        "billing_cycle",
        "current_period_start",
        "current_period_end",
        "cancel_at_period_end",
    )
    list_filter = ("status", "billing_cycle")
    search_fields = ("agency__name", "plan__name")


@admin.register(AgencyInvoice)
class AgencyInvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "number",
        "agency",
        "amount",
        "currency",
        "status",
        "provider",
        "provider_status",
        "issued_at",
        "paid_at",
    )
    list_filter = ("status", "currency")
    search_fields = ("number", "agency__name")
