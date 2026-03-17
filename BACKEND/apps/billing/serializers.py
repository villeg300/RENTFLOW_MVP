from rest_framework import serializers

from .models import AgencyInvoice, AgencySubscription, Plan


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = (
            "id",
            "name",
            "code",
            "description",
            "price_monthly",
            "price_yearly",
            "currency",
            "max_properties",
            "max_users",
            "max_units",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class SubscriptionSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)
    plan_id = serializers.PrimaryKeyRelatedField(
        queryset=Plan.objects.filter(is_active=True),
        source="plan",
        write_only=True,
        required=False,
    )

    class Meta:
        model = AgencySubscription
        fields = (
            "id",
            "agency",
            "plan",
            "plan_id",
            "status",
            "billing_cycle",
            "current_period_start",
            "current_period_end",
            "trial_end",
            "cancel_at_period_end",
            "started_at",
            "ended_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "agency",
            "status",
            "current_period_start",
            "current_period_end",
            "started_at",
            "ended_at",
            "created_at",
            "updated_at",
        )


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgencyInvoice
        fields = (
            "id",
            "agency",
            "subscription",
            "number",
            "amount",
            "currency",
            "status",
            "period_start",
            "period_end",
            "issued_at",
            "due_at",
            "paid_at",
            "provider",
            "provider_reference",
            "provider_status",
            "provider_payload",
            "payment_url",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "agency",
            "subscription",
            "number",
            "provider",
            "provider_reference",
            "provider_status",
            "provider_payload",
            "payment_url",
            "created_at",
            "updated_at",
        )
