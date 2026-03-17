from datetime import datetime, timedelta

from django.db.models import Count
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.agencies.mixins import AgencyScopedMixin
from apps.agencies.permissions import IsAgencyMember

from apps.agencies.permissions import IsAgencyOperator
from .models import NotificationLog
from .services.reminders import send_bulk_reminders
from .serializers import NotificationLogSerializer


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
