from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "lease", "amount", "status", "paid_at", "created_at")
    search_fields = ("lease__tenant_name", "reference")
    list_filter = ("status", "paid_at")
