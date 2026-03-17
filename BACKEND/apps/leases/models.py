import uuid

from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.agencies.models import Agency
from apps.properties.models import Property


class LeaseStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    ENDED = "ended", "Ended"
    CANCELLED = "cancelled", "Cancelled"


class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agency = models.ForeignKey(Agency, on_delete=models.CASCADE, related_name="tenants")
    full_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    id_number = models.CharField(max_length=50, blank=True)
    address = models.CharField(max_length=255, blank=True)
    emergency_contact_name = models.CharField(max_length=255, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Tenant"
        verbose_name_plural = "Tenants"
        constraints = [
            models.UniqueConstraint(
                fields=["agency", "phone_number"],
                name="unique_tenant_phone_per_agency",
            ),
            models.UniqueConstraint(
                fields=["agency", "email"],
                condition=Q(email__isnull=False) & ~Q(email=""),
                name="unique_tenant_email_per_agency",
            ),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.phone_number})"


class Lease(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agency = models.ForeignKey(Agency, on_delete=models.CASCADE, related_name="leases")
    property = models.ForeignKey(
        Property, on_delete=models.PROTECT, related_name="leases"
    )
    tenant = models.ForeignKey(
        Tenant, on_delete=models.SET_NULL, null=True, blank=True, related_name="leases"
    )
    tenant_name = models.CharField(max_length=255)
    tenant_phone = models.CharField(max_length=20, blank=True)
    tenant_email = models.EmailField(blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    rent_amount = models.DecimalField(max_digits=12, decimal_places=2)
    deposit_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    status = models.CharField(
        max_length=20, choices=LeaseStatus.choices, default=LeaseStatus.ACTIVE
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Lease"
        verbose_name_plural = "Leases"

    def __str__(self):
        tenant_label = self.tenant.full_name if self.tenant else self.tenant_name
        return f"{self.property} - {tenant_label}"
