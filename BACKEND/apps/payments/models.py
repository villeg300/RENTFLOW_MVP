import uuid

from django.db import models
from django.utils import timezone

from apps.agencies.models import Agency
from apps.leases.models import Lease


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PAID = "paid", "Paid"
    FAILED = "failed", "Failed"


class Payment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agency = models.ForeignKey(
        Agency, on_delete=models.CASCADE, related_name="payments"
    )
    lease = models.ForeignKey(
        Lease, on_delete=models.PROTECT, related_name="payments"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(
        max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PAID
    )
    paid_at = models.DateTimeField(default=timezone.now)
    reference = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    receipt_number = models.CharField(max_length=50, blank=True)
    receipt_file = models.FileField(
        upload_to="receipts/%Y/%m/", null=True, blank=True
    )
    receipt_issued_at = models.DateTimeField(null=True, blank=True)
    receipt_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-paid_at"]
        verbose_name = "Payment"
        verbose_name_plural = "Payments"

    def __str__(self):
        return f"{self.lease} - {self.amount}"
