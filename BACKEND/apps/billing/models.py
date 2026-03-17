import uuid
from datetime import timedelta

from django.db import models
from django.utils import timezone

from apps.agencies.models import Agency


class BillingCycle(models.TextChoices):
    MONTHLY = "monthly", "Monthly"
    YEARLY = "yearly", "Yearly"


class Plan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    code = models.SlugField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    price_monthly = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    price_yearly = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    currency = models.CharField(max_length=10, default="XOF")
    max_properties = models.PositiveIntegerField(null=True, blank=True)
    max_users = models.PositiveIntegerField(null=True, blank=True)
    max_units = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["price_monthly", "name"]
        verbose_name = "Plan"
        verbose_name_plural = "Plans"

    def __str__(self):
        return f"{self.name} ({self.currency} {self.price_monthly}/mo)"


class SubscriptionStatus(models.TextChoices):
    TRIALING = "trialing", "Trialing"
    ACTIVE = "active", "Active"
    PAST_DUE = "past_due", "Past due"
    CANCELED = "canceled", "Canceled"


class AgencySubscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agency = models.OneToOneField(
        Agency, on_delete=models.CASCADE, related_name="subscription"
    )
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(
        max_length=20, choices=SubscriptionStatus.choices, default=SubscriptionStatus.ACTIVE
    )
    billing_cycle = models.CharField(
        max_length=10, choices=BillingCycle.choices, default=BillingCycle.MONTHLY
    )
    current_period_start = models.DateTimeField(default=timezone.now)
    current_period_end = models.DateTimeField(default=timezone.now)
    trial_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Agency subscription"
        verbose_name_plural = "Agency subscriptions"

    def __str__(self):
        return f"{self.agency} -> {self.plan} ({self.status})"

    def set_period(self, start=None):
        start_at = start or timezone.now()
        if self.billing_cycle == BillingCycle.YEARLY:
            end_at = start_at + timedelta(days=365)
        else:
            end_at = start_at + timedelta(days=30)
        self.current_period_start = start_at
        self.current_period_end = end_at

    @property
    def is_active(self):
        if self.status in (SubscriptionStatus.CANCELED,):
            return False
        return True


class InvoiceStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    ISSUED = "issued", "Issued"
    PAID = "paid", "Paid"
    VOID = "void", "Void"


class AgencyInvoice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agency = models.ForeignKey(Agency, on_delete=models.CASCADE, related_name="invoices")
    subscription = models.ForeignKey(
        AgencySubscription, on_delete=models.CASCADE, related_name="invoices"
    )
    number = models.CharField(max_length=50, unique=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default="XOF")
    status = models.CharField(
        max_length=20, choices=InvoiceStatus.choices, default=InvoiceStatus.ISSUED
    )
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    provider = models.CharField(max_length=50, blank=True)
    provider_reference = models.CharField(max_length=120, blank=True)
    provider_status = models.CharField(max_length=50, blank=True)
    provider_payload = models.JSONField(null=True, blank=True)
    payment_url = models.URLField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Agency invoice"
        verbose_name_plural = "Agency invoices"

    def __str__(self):
        return f"{self.number or 'Invoice'} - {self.agency}"

    def _build_number(self):
        date_part = timezone.now().strftime("%Y%m%d")
        short_id = str(self.id).split("-")[0].upper()
        return f"RF-INV-{date_part}-{short_id}"

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)
        if is_new and not self.number:
            self.number = self._build_number()
            super().save(update_fields=["number"])
