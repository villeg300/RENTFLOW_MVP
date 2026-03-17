from rest_framework import serializers

from apps.properties.models import Property

from apps.payments.models import Payment

from .models import Lease, Tenant


class TenantLeaseSerializer(serializers.ModelSerializer):
    property_title = serializers.CharField(source="property.title", read_only=True)

    class Meta:
        model = Lease
        fields = (
            "id",
            "property",
            "property_title",
            "start_date",
            "end_date",
            "status",
            "rent_amount",
        )


class TenantPaymentSerializer(serializers.ModelSerializer):
    property_title = serializers.CharField(
        source="lease.property.title", read_only=True
    )

    class Meta:
        model = Payment
        fields = (
            "id",
            "lease",
            "property_title",
            "amount",
            "status",
            "paid_at",
            "reference",
            "notes",
        )


class TenantSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = (
            "id",
            "full_name",
            "phone_number",
            "email",
            "is_active",
        )


class TenantListSerializer(serializers.ModelSerializer):
    leases_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Tenant
        fields = (
            "id",
            "agency",
            "full_name",
            "phone_number",
            "email",
            "is_active",
            "leases_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "agency", "created_at", "updated_at")


class TenantSerializer(serializers.ModelSerializer):
    leases = TenantLeaseSerializer(many=True, read_only=True)
    leases_count = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = (
            "id",
            "agency",
            "full_name",
            "phone_number",
            "email",
            "id_number",
            "address",
            "emergency_contact_name",
            "emergency_contact_phone",
            "is_active",
            "notes",
            "leases_count",
            "leases",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "agency", "created_at", "updated_at")

    def get_leases_count(self, obj):
        return getattr(obj, "leases_count", obj.leases.count())


class LeaseSerializer(serializers.ModelSerializer):
    tenant_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Lease
        fields = (
            "id",
            "agency",
            "property",
            "tenant",
            "tenant_name",
            "tenant_phone",
            "tenant_email",
            "start_date",
            "end_date",
            "rent_amount",
            "deposit_amount",
            "status",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "agency", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        agency = self.context.get("agency")
        if not agency:
            request = self.context.get("request")
            agency = getattr(request, "agency", None) if request else None
        if agency:
            self.fields["property"].queryset = Property.objects.filter(agency=agency)
            self.fields["tenant"].queryset = Tenant.objects.filter(agency=agency)

    def validate_property(self, value):
        agency = self.context.get("agency")
        if not agency:
            request = self.context.get("request")
            agency = getattr(request, "agency", None) if request else None
        if agency and value.agency_id != agency.id:
            raise serializers.ValidationError(
                "Ce bien n'appartient pas a l'agence active."
            )
        return value

    def validate_tenant(self, value):
        agency = self.context.get("agency")
        if not agency:
            request = self.context.get("request")
            agency = getattr(request, "agency", None) if request else None
        if agency and value.agency_id != agency.id:
            raise serializers.ValidationError(
                "Ce locataire n'appartient pas a l'agence active."
            )
        return value

    def validate(self, attrs):
        tenant = attrs.get("tenant")
        tenant_name = attrs.get("tenant_name")
        if self.instance and tenant_name is None:
            tenant_name = self.instance.tenant_name
        if not tenant and not tenant_name:
            raise serializers.ValidationError(
                {"tenant_name": "Renseignez tenant_name ou tenant."}
            )
        return attrs

    def _hydrate_from_tenant(self, attrs, tenant):
        if not attrs.get("tenant_name"):
            attrs["tenant_name"] = tenant.full_name
        if not attrs.get("tenant_phone") and tenant.phone_number:
            attrs["tenant_phone"] = tenant.phone_number
        if not attrs.get("tenant_email") and tenant.email:
            attrs["tenant_email"] = tenant.email

    def create(self, validated_data):
        tenant = validated_data.get("tenant")
        if tenant:
            self._hydrate_from_tenant(validated_data, tenant)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        tenant = validated_data.get("tenant") or getattr(instance, "tenant", None)
        if tenant:
            self._hydrate_from_tenant(validated_data, tenant)
        return super().update(instance, validated_data)
