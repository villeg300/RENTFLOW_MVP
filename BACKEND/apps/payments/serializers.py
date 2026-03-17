from rest_framework import serializers

from apps.leases.models import Lease

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = (
            "id",
            "agency",
            "lease",
            "amount",
            "status",
            "paid_at",
            "reference",
            "notes",
            "receipt_number",
            "receipt_file",
            "receipt_issued_at",
            "receipt_sent_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "agency",
            "receipt_number",
            "receipt_file",
            "receipt_issued_at",
            "receipt_sent_at",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        agency = self.context.get("agency")
        if not agency:
            request = self.context.get("request")
            agency = getattr(request, "agency", None) if request else None
        if agency:
            self.fields["lease"].queryset = Lease.objects.filter(agency=agency)

    def validate_lease(self, value):
        agency = self.context.get("agency")
        if not agency:
            request = self.context.get("request")
            agency = getattr(request, "agency", None) if request else None
        if agency and value.agency_id != agency.id:
            raise serializers.ValidationError(
                "Ce contrat n'appartient pas a l'agence active."
            )
        return value
