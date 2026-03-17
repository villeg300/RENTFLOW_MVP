from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.billing.models import (
    AgencyInvoice,
    BillingCycle,
    InvoiceStatus,
    SubscriptionStatus,
)


class Command(BaseCommand):
    help = "Expire les essais gratuits et emet une facture."

    def handle(self, *args, **options):
        now = timezone.now()
        expired = 0
        from apps.billing.models import AgencySubscription  # avoid circular

        qs = AgencySubscription.objects.filter(
            status=SubscriptionStatus.TRIALING,
            trial_end__isnull=False,
            trial_end__lte=now,
        )
        for subscription in qs:
            subscription.status = SubscriptionStatus.PAST_DUE
            subscription.trial_end = None
            subscription.set_period(start=now)
            subscription.save(update_fields=[
                "status",
                "trial_end",
                "current_period_start",
                "current_period_end",
                "updated_at",
            ])

            period_start = subscription.current_period_start.date()
            if not AgencyInvoice.objects.filter(
                subscription=subscription, period_start=period_start
            ).exists():
                amount = (
                    subscription.plan.price_yearly
                    if subscription.billing_cycle == BillingCycle.YEARLY
                    and subscription.plan.price_yearly is not None
                    else subscription.plan.price_monthly * (12 if subscription.billing_cycle == BillingCycle.YEARLY else 1)
                )
                AgencyInvoice.objects.create(
                    agency=subscription.agency,
                    subscription=subscription,
                    amount=amount,
                    currency=subscription.plan.currency,
                    status=InvoiceStatus.ISSUED if amount else InvoiceStatus.PAID,
                    period_start=subscription.current_period_start.date(),
                    period_end=subscription.current_period_end.date(),
                    issued_at=now,
                    due_at=now + timedelta(days=7),
                    paid_at=now if not amount else None,
                )
            expired += 1

        self.stdout.write(self.style.SUCCESS(f"Trials expires: {expired}"))
