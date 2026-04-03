from datetime import datetime, timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.agencies.mixins import AgencyScopedMixin
from apps.agencies.permissions import IsAgencyMember

from apps.agencies.permissions import IsAgencyOperator
from apps.leases.models import Lease, LeaseStatus
from apps.payments.models import Payment, PaymentStatus
from .models import NotificationLog, NotificationStatus
from .services.reminders import send_bulk_reminders
from .serializers import NotificationLogSerializer

REMINDER_TEMPLATE_KEYS = {
    "rent_due_soon",
    "rent_due_today",
    "rent_overdue",
    "rent_reminder",
    "bulk_reminder",
    "manual_reminder",
}


def _month_due_date(base_date, due_day):
    if due_day < 1:
        due_day = 1
    next_month = base_date.replace(day=28) + timedelta(days=4)
    last_day = (next_month.replace(day=1) - timedelta(days=1)).day
    return base_date.replace(day=min(due_day, last_day))


class NotificationLogViewSet(AgencyScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = NotificationLog.objects.select_related("lease", "tenant", "lease__property")
    serializer_class = NotificationLogSerializer
    permission_classes = [IsAuthenticated, IsAgencyMember]

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        status = params.get("status")
        if status:
            queryset = queryset.filter(status=status)

        channel = params.get("channel")
        if channel:
            queryset = queryset.filter(channel=channel)

        template_key = params.get("template_key")
        if template_key:
            queryset = queryset.filter(template_key=template_key)

        lease_id = params.get("lease_id")
        if lease_id:
            queryset = queryset.filter(lease_id=lease_id)

        tenant_id = params.get("tenant_id")
        if tenant_id:
            queryset = queryset.filter(tenant_id=tenant_id)

        date_from = params.get("date_from")
        if date_from:
            try:
                from_date = datetime.strptime(date_from, "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError("date_from invalide (YYYY-MM-DD).")
            queryset = queryset.filter(scheduled_for__gte=from_date)

        date_to = params.get("date_to")
        if date_to:
            try:
                to_date = datetime.strptime(date_to, "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError("date_to invalide (YYYY-MM-DD).")
            queryset = queryset.filter(scheduled_for__lte=to_date)

        return queryset


class NotificationDashboardView(AgencyScopedMixin, viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsAgencyMember]

    def list(self, request, *args, **kwargs):
        agency = self.get_agency()
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if date_from and date_to:
            try:
                start = datetime.strptime(date_from, "%Y-%m-%d").date()
                end = datetime.strptime(date_to, "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError("date_from/date_to invalide (YYYY-MM-DD).")
        else:
            end = timezone.localdate()
            start = end - timedelta(days=30)

        logs = NotificationLog.objects.filter(
            agency=agency, scheduled_for__gte=start, scheduled_for__lte=end
        )

        total = logs.count()
        by_status = {
            item["status"]: item["count"]
            for item in logs.values("status").annotate(count=Count("id"))
        }
        by_channel = {
            item["channel"]: item["count"]
            for item in logs.values("channel").annotate(count=Count("id"))
        }

        return Response(
            {
                "period": {
                    "date_from": start.isoformat(),
                    "date_to": end.isoformat(),
                },
                "total": total,
                "by_status": by_status,
                "by_channel": by_channel,
            }
        )


class NotificationReminderQueueView(AgencyScopedMixin, viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsAgencyMember]

    def list(self, request, *args, **kwargs):
        agency = self.get_agency()
        today = timezone.localdate()

        logs_qs = NotificationLog.objects.filter(
            agency=agency, template_key__in=REMINDER_TEMPLATE_KEYS
        ).select_related("lease", "lease__property")

        reminder_today_ids = set(
            logs_qs.filter(scheduled_for=today).values_list("lease_id", flat=True)
        )

        latest_by_lease = {}
        for log in logs_qs.order_by("-scheduled_for", "-created_at"):
            if log.lease_id not in latest_by_lease:
                latest_by_lease[log.lease_id] = log

        items = []
        failed_lease_ids = set()
        for log in latest_by_lease.values():
            if log.status != NotificationStatus.FAILED:
                continue
            if log.lease_id in reminder_today_ids:
                continue
            lease = log.lease
            if not lease:
                continue
            items.append(
                {
                    "id": str(log.id),
                    "lease_id": str(log.lease_id),
                    "tenant_name": log.tenant_name or lease.tenant_name,
                    "property_title": log.property_title
                    or (lease.property.title if lease.property else ""),
                    "rent_amount": float(lease.rent_amount or 0),
                    "channel": log.channel,
                    "template_key": log.template_key,
                    "status": "failed",
                    "scheduled_for": log.scheduled_for.isoformat()
                    if log.scheduled_for
                    else None,
                }
            )
            failed_lease_ids.add(log.lease_id)

        reminded_lease_ids = set(latest_by_lease.keys())

        month_start = today.replace(day=1)
        next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)

        paid_lease_ids = set(
            Payment.objects.filter(
                agency=agency,
                status=PaymentStatus.PAID,
                paid_at__date__gte=month_start,
                paid_at__date__lt=next_month,
            ).values_list("lease_id", flat=True)
        )

        active_leases = (
            Lease.objects.filter(agency=agency, status=LeaseStatus.ACTIVE)
            .select_related("property")
            .filter(start_date__lte=today)
            .filter(Q(end_date__isnull=True) | Q(end_date__gte=month_start))
        )

        for lease in active_leases.exclude(id__in=paid_lease_ids):
            if lease.id in reminded_lease_ids:
                continue
            if lease.id in failed_lease_ids:
                continue
            if lease.id in reminder_today_ids:
                continue

            due_date = _month_due_date(today, lease.start_date.day)
            overdue_days = (today - due_date).days
            if overdue_days <= 0:
                continue

            items.append(
                {
                    "id": str(lease.id),
                    "lease_id": str(lease.id),
                    "tenant_name": lease.tenant_name,
                    "property_title": lease.property.title if lease.property else "",
                    "rent_amount": float(lease.rent_amount or 0),
                    "channel": None,
                    "template_key": "overdue_payment",
                    "status": "overdue",
                    "scheduled_for": due_date.isoformat(),
                }
            )

        return Response(items)


class NotificationBulkReminderView(AgencyScopedMixin, viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsAgencyOperator]

    def create(self, request, *args, **kwargs):
        agency = self.get_agency()
        data = request.data or {}

        channels = data.get("channels")
        message = data.get("message")
        due_date = data.get("due_date")
        overdue_min_days = data.get("overdue_min_days")
        overdue_max_days = data.get("overdue_max_days")
        only_overdue = data.get("only_overdue", False)

        if due_date:
            try:
                due_date = datetime.strptime(due_date, "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError("due_date invalide (YYYY-MM-DD).")

        def _to_int(value):
            if value is None or value == "":
                return None
            try:
                return int(value)
            except (TypeError, ValueError):
                raise ValidationError("overdue_min_days/overdue_max_days invalide.")

        overdue_min_days = _to_int(overdue_min_days)
        overdue_max_days = _to_int(overdue_max_days)

        results = send_bulk_reminders(
            agency=agency,
            channels=channels,
            message=message,
            due_date=due_date,
            overdue_min_days=overdue_min_days,
            overdue_max_days=overdue_max_days,
            only_overdue=bool(only_overdue),
        )

        return Response({"detail": "Rappels envoyes.", "results": results})
