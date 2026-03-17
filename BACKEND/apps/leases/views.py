from datetime import datetime, timedelta
import csv

from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.agencies.mixins import AgencyScopedMixin
from apps.agencies.permissions import IsAgencyMember, IsAgencyOperator
from apps.notifications.models import TenantNotificationPreference
from apps.notifications.serializers import TenantNotificationPreferenceSerializer
from apps.notifications.services.reminders import send_manual_reminder
from apps.notifications.services.whatsapp import WhatsAppService
from apps.payments.models import Payment

from .models import Lease, Tenant
from .serializers import (
    LeaseSerializer,
    TenantLeaseSerializer,
    TenantListSerializer,
    TenantPaymentSerializer,
    TenantSerializer,
    TenantSummarySerializer,
)


class LeaseViewSet(AgencyScopedMixin, viewsets.ModelViewSet):
    queryset = Lease.objects.all()
    serializer_class = LeaseSerializer
    permission_classes = [IsAuthenticated, IsAgencyMember]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "remind"):
            return [IsAuthenticated(), IsAgencyOperator()]
        return super().get_permissions()

    @action(detail=True, methods=["post"], url_path="remind")
    def remind(self, request, *args, **kwargs):
        lease = self.get_object()
        channels = request.data.get("channels")
        message = request.data.get("message")
        results = send_manual_reminder(lease, channels=channels, message=message)
        return Response({"detail": "Rappel envoye.", "results": results})

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request, *args, **kwargs):
        queryset = self.get_queryset().select_related("property", "tenant")
        status_param = request.query_params.get("status")
        property_id = request.query_params.get("property_id")
        tenant_id = request.query_params.get("tenant_id")
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")

        if status_param:
            queryset = queryset.filter(status=status_param)
        if property_id:
            queryset = queryset.filter(property_id=property_id)
        if tenant_id:
            queryset = queryset.filter(tenant_id=tenant_id)

        if start_date or end_date:
            if not start_date or not end_date:
                return Response({"detail": "start_date et end_date sont requis ensemble."}, status=400)
            start = parse_date(start_date)
            end = parse_date(end_date)
            if not start or not end:
                return Response({"detail": "Format de date invalide (YYYY-MM-DD)."}, status=400)
            if start > end:
                return Response({"detail": "start_date doit etre avant end_date."}, status=400)
            start_dt = timezone.make_aware(datetime.combine(start, datetime.min.time()))
            end_dt = timezone.make_aware(datetime.combine(end + timedelta(days=1), datetime.min.time()))
            queryset = queryset.filter(
                start_date__gte=start_dt.date(),
                start_date__lt=end_dt.date(),
            )

        filename = f"leases_export_{timezone.now().strftime('%Y%m%d')}.csv"
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        writer = csv.writer(response)
        writer.writerow([
            "id",
            "property_id",
            "property_title",
            "tenant_id",
            "tenant_name",
            "tenant_phone",
            "tenant_email",
            "start_date",
            "end_date",
            "rent_amount",
            "deposit_amount",
            "status",
            "created_at",
        ])
        for lease in queryset.order_by("-created_at"):
            writer.writerow([
                lease.id,
                lease.property_id,
                lease.property.title if lease.property else "",
                lease.tenant_id,
                lease.tenant_name,
                lease.tenant_phone,
                lease.tenant_email,
                lease.start_date.isoformat() if lease.start_date else "",
                lease.end_date.isoformat() if lease.end_date else "",
                lease.rent_amount,
                lease.deposit_amount,
                lease.status,
                lease.created_at.isoformat(),
            ])
        return response


class TenantPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class TenantLeaseHistoryPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "leases_page_size"
    page_query_param = "leases_page"
    max_page_size = 100


class TenantPaymentHistoryPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "payments_page_size"
    page_query_param = "payments_page"
    max_page_size = 100


class TenantViewSet(AgencyScopedMixin, viewsets.ModelViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    pagination_class = TenantPagination
    permission_classes = [IsAuthenticated, IsAgencyMember]

    def get_permissions(self):
        if self.action in (
            "create",
            "update",
            "partial_update",
            "destroy",
            "preferences",
            "whatsapp_verify",
            "whatsapp_confirm",
        ):
            return [IsAuthenticated(), IsAgencyOperator()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        if self.action == "list":
            queryset = queryset.annotate(leases_count=Count("leases"))

        q = params.get("q")
        if q:
            queryset = queryset.filter(
                Q(full_name__icontains=q)
                | Q(phone_number__icontains=q)
                | Q(email__icontains=q)
            )

        phone = params.get("phone")
        if phone:
            queryset = queryset.filter(phone_number__icontains=phone)

        email = params.get("email")
        if email:
            queryset = queryset.filter(email__icontains=email)

        is_active = params.get("is_active")
        if is_active is not None:
            if is_active.lower() in ("true", "1", "yes"):
                queryset = queryset.filter(is_active=True)
            elif is_active.lower() in ("false", "0", "no"):
                queryset = queryset.filter(is_active=False)

        ordering = params.get("ordering")
        if ordering:
            allowed_fields = {"full_name", "created_at", "updated_at", "phone_number"}
            ordering_fields = []
            for item in ordering.split(","):
                item = item.strip()
                if not item:
                    continue
                field_name = item.lstrip("-")
                if field_name in allowed_fields:
                    ordering_fields.append(item)
            if ordering_fields:
                queryset = queryset.order_by(*ordering_fields)
        else:
            queryset = queryset.order_by("-created_at")

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return TenantListSerializer
        if self.action == "history":
            return TenantSummarySerializer
        return TenantSerializer

    @action(detail=True, methods=["get", "put", "patch"], url_path="preferences")
    def preferences(self, request, *args, **kwargs):
        tenant = self.get_object()
        preference = TenantNotificationPreference.objects.filter(tenant=tenant).first()
        if request.method == "GET":
            serializer = TenantNotificationPreferenceSerializer(preference)
            return Response(serializer.data if preference else {})

        serializer = TenantNotificationPreferenceSerializer(
            preference, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(tenant=tenant)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="whatsapp/verify")
    def whatsapp_verify(self, request, *args, **kwargs):
        tenant = self.get_object()
        if not tenant.phone_number:
            return Response({"detail": "Numero de telephone requis."}, status=400)

        preference, _ = TenantNotificationPreference.objects.get_or_create(
            tenant=tenant
        )

        import secrets
        from django.contrib.auth.hashers import make_password
        from django.utils import timezone
        from django.conf import settings

        code = f"{secrets.randbelow(1000000):06d}"
        preference.whatsapp_verification_code = make_password(code)
        preference.whatsapp_verification_expires_at = timezone.now() + timedelta(
            minutes=settings.WHATSAPP_VERIFY_TTL_MINUTES
        )
        preference.whatsapp_verified = False
        preference.whatsapp_verified_at = None
        preference.save(
            update_fields=[
                "whatsapp_verification_code",
                "whatsapp_verification_expires_at",
                "whatsapp_verified",
                "whatsapp_verified_at",
                "updated_at",
            ]
        )

        message = f"Votre code de verification WhatsApp est: {code}"
        WhatsAppService().send_message(tenant.phone_number, message)

        return Response({"detail": "Code de verification envoye."})

    @action(detail=True, methods=["post"], url_path="whatsapp/confirm")
    def whatsapp_confirm(self, request, *args, **kwargs):
        tenant = self.get_object()
        code = request.data.get("code")
        if not code:
            return Response({"detail": "Code requis."}, status=400)

        preference = TenantNotificationPreference.objects.filter(tenant=tenant).first()
        if not preference or not preference.whatsapp_verification_code:
            return Response({"detail": "Aucun code en attente."}, status=400)

        from django.contrib.auth.hashers import check_password
        from django.utils import timezone

        if (
            preference.whatsapp_verification_expires_at
            and preference.whatsapp_verification_expires_at < timezone.now()
        ):
            return Response({"detail": "Code expire."}, status=400)

        if not check_password(code, preference.whatsapp_verification_code):
            return Response({"detail": "Code invalide."}, status=400)

        preference.whatsapp_verified = True
        preference.whatsapp_verified_at = timezone.now()
        preference.whatsapp_verification_code = ""
        preference.whatsapp_verification_expires_at = None
        preference.save(
            update_fields=[
                "whatsapp_verified",
                "whatsapp_verified_at",
                "whatsapp_verification_code",
                "whatsapp_verification_expires_at",
                "updated_at",
            ]
        )

        return Response({"detail": "Numero WhatsApp verifie."})

    @action(detail=True, methods=["get"])
    def history(self, request, *args, **kwargs):
        tenant = self.get_object()
        leases = (
            tenant.leases.select_related("property")
            .order_by("-start_date")
        )
        payments = (
            Payment.objects.filter(lease__tenant=tenant, lease__agency=tenant.agency)
            .select_related("lease", "lease__property")
            .order_by("-paid_at")
        )

        leases_paginator = TenantLeaseHistoryPagination()
        payments_paginator = TenantPaymentHistoryPagination()

        leases_page = leases_paginator.paginate_queryset(
            leases, request, view=self
        )
        payments_page = payments_paginator.paginate_queryset(
            payments, request, view=self
        )

        leases_data = TenantLeaseSerializer(
            leases_page if leases_page is not None else leases, many=True
        ).data
        payments_data = TenantPaymentSerializer(
            payments_page if payments_page is not None else payments, many=True
        ).data

        return Response(
            {
                "tenant": TenantSummarySerializer(
                    tenant, context=self.get_serializer_context()
                ).data,
                "leases": {
                    "count": leases_paginator.page.paginator.count
                    if leases_page is not None
                    else len(leases_data),
                    "next": leases_paginator.get_next_link()
                    if leases_page is not None
                    else None,
                    "previous": leases_paginator.get_previous_link()
                    if leases_page is not None
                    else None,
                    "results": leases_data,
                },
                "payments": {
                    "count": payments_paginator.page.paginator.count
                    if payments_page is not None
                    else len(payments_data),
                    "next": payments_paginator.get_next_link()
                    if payments_page is not None
                    else None,
                    "previous": payments_paginator.get_previous_link()
                    if payments_page is not None
                    else None,
                    "results": payments_data,
                },
            }
        )

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request, *args, **kwargs):
        queryset = self.get_queryset().annotate(leases_count=Count("leases"))

        filename = f"tenants_export_{timezone.now().strftime('%Y%m%d')}.csv"
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        writer = csv.writer(response)
        writer.writerow([
            "id",
            "full_name",
            "phone_number",
            "email",
            "is_active",
            "leases_count",
            "created_at",
        ])
        for tenant in queryset.order_by("-created_at"):
            writer.writerow([
                tenant.id,
                tenant.full_name,
                tenant.phone_number,
                tenant.email,
                tenant.is_active,
                getattr(tenant, "leases_count", 0),
                tenant.created_at.isoformat(),
            ])
        return response
