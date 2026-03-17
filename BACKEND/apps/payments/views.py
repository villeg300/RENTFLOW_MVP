from datetime import datetime, timedelta
from decimal import Decimal
import csv
from io import BytesIO

import logging

from django.conf import settings
from django.db.models import Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.core.files.base import ContentFile
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from apps.agencies.mixins import AgencyScopedMixin
from apps.agencies.permissions import IsAgencyMember, IsAgencyOperator
from apps.leases.models import Lease, LeaseStatus
from apps.properties.models import Property

from .models import Payment, PaymentStatus
from .serializers import PaymentSerializer


def _month_start(dt):
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _add_months(dt, months):
    month_index = dt.month - 1 + months
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    return dt.replace(year=year, month=month, day=1)


def _to_float(value):
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


class PaymentViewSet(AgencyScopedMixin, viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsAgencyMember]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAgencyOperator()]
        return super().get_permissions()

    def _send_receipt_email(self, payment, pdf_bytes):
        tenant_email = payment.lease.tenant_email
        if not tenant_email and payment.lease.tenant:
            tenant_email = payment.lease.tenant.email
        if not tenant_email:
            raise ValidationError("Aucun email locataire pour envoyer la quittance.")

        subject = f"Quittance de loyer {payment.receipt_number}"
        context = {
            "receipt_number": payment.receipt_number,
            "amount": payment.amount,
            "currency": "XOF",
            "paid_at": timezone.localtime(payment.paid_at).strftime("%Y-%m-%d"),
            "property_title": payment.lease.property.title,
            "tenant_name": payment.lease.tenant_name,
            "agency_name": payment.agency.name,
        }
        body_txt = render_to_string("email/receipt_email.txt", context)
        body_html = render_to_string("email/receipt_email.html", context)

        email = EmailMultiAlternatives(
            subject=subject,
            body=body_txt,
            to=[tenant_email],
        )
        email.attach_alternative(body_html, "text/html")
        email.attach(
            f"receipt_{payment.receipt_number}.pdf", pdf_bytes, "application/pdf"
        )
        email.send()

        payment.receipt_sent_at = timezone.now()
        payment.save(update_fields=["receipt_sent_at", "updated_at"])

    def perform_create(self, serializer):
        payment = serializer.save(agency=self.get_agency())
        if (
            payment.status == PaymentStatus.PAID
            and getattr(settings, "PAYMENT_AUTO_SEND_RECEIPT", False)
        ):
            try:
                pdf_bytes = self._ensure_receipt(payment)
                self._send_receipt_email(payment, pdf_bytes)
            except Exception:
                logging.getLogger(__name__).exception(
                    "Auto-send receipt failed", extra={"payment_id": str(payment.id)}
                )

    def perform_update(self, serializer):
        previous_status = getattr(self.get_object(), "status")
        payment = serializer.save()
        if (
            previous_status != PaymentStatus.PAID
            and payment.status == PaymentStatus.PAID
            and getattr(settings, "PAYMENT_AUTO_SEND_RECEIPT", False)
        ):
            try:
                pdf_bytes = self._ensure_receipt(payment)
                self._send_receipt_email(payment, pdf_bytes)
            except Exception:
                logging.getLogger(__name__).exception(
                    "Auto-send receipt failed", extra={"payment_id": str(payment.id)}
                )

    def _build_receipt_number(self, payment):
        date_part = payment.paid_at.strftime("%Y%m%d")
        short_id = str(payment.id).split("-")[0].upper()
        return f"RF-{date_part}-{short_id}"

    def _render_receipt_pdf(self, payment):
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        agency = payment.agency
        lease = payment.lease
        property_obj = lease.property
        tenant_name = lease.tenant_name
        paid_at = timezone.localtime(payment.paid_at)

        y = height - 60
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, y, "Quittance de loyer")
        y -= 30

        c.setFont("Helvetica", 10)
        c.drawString(50, y, f"Agence: {agency.name}")
        y -= 15
        c.drawString(50, y, f"Bien: {property_obj.title} - {property_obj.address}")
        y -= 15
        c.drawString(50, y, f"Locataire: {tenant_name}")
        y -= 15
        c.drawString(50, y, f"Date paiement: {paid_at.strftime('%Y-%m-%d')}")
        y -= 15
        c.drawString(50, y, f"Reference: {payment.reference or '-'}")
        y -= 30

        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, y, f"Montant paye: {payment.amount} XOF")
        y -= 15
        c.setFont("Helvetica", 10)
        c.drawString(50, y, f"Numero de quittance: {payment.receipt_number}")

        c.showPage()
        c.save()
        pdf = buffer.getvalue()
        buffer.close()
        return pdf

    def _ensure_receipt(self, payment):
        updated = False
        if not payment.receipt_number:
            payment.receipt_number = self._build_receipt_number(payment)
            updated = True
        if not payment.receipt_issued_at:
            payment.receipt_issued_at = timezone.now()
            updated = True

        pdf_bytes = None
        if not payment.receipt_file:
            pdf_bytes = self._render_receipt_pdf(payment)
            filename = f"receipt_{payment.receipt_number}.pdf"
            payment.receipt_file.save(filename, ContentFile(pdf_bytes), save=False)
            updated = True

        if updated:
            payment.save(update_fields=[
                "receipt_number",
                "receipt_file",
                "receipt_issued_at",
                "updated_at",
            ])

        if pdf_bytes is None:
            with payment.receipt_file.open("rb") as handle:
                pdf_bytes = handle.read()

        return pdf_bytes

    @action(detail=True, methods=["get"], url_path="receipt")
    def receipt(self, request, *args, **kwargs):
        payment = self.get_object()
        pdf_bytes = self._ensure_receipt(payment)
        filename = payment.receipt_file.name.split("/")[-1]
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        return response

    @action(detail=True, methods=["post"], url_path="receipt/send")
    def send_receipt(self, request, *args, **kwargs):
        payment = self.get_object()
        pdf_bytes = self._ensure_receipt(payment)

        self._send_receipt_email(payment, pdf_bytes)

        return Response({"detail": "Quittance envoyee."})

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request, *args, **kwargs):
        date_field = request.query_params.get("date_field", "paid_at")
        if date_field not in ("paid_at", "created_at"):
            raise ValidationError("date_field invalide. Utilisez paid_at ou created_at.")

        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        status_param = request.query_params.get("status")

        queryset = self.get_queryset()
        if status_param:
            queryset = queryset.filter(status=status_param)

        if start_date or end_date:
            if not start_date or not end_date:
                raise ValidationError("start_date et end_date sont requis ensemble.")
            start = parse_date(start_date)
            end = parse_date(end_date)
            if not start or not end:
                raise ValidationError("Format de date invalide (YYYY-MM-DD).")
            if start > end:
                raise ValidationError("start_date doit etre avant end_date.")
            start_dt = timezone.make_aware(datetime.combine(start, datetime.min.time()))
            end_dt = timezone.make_aware(datetime.combine(end + timedelta(days=1), datetime.min.time()))
            filter_kwargs = {
                f"{date_field}__gte": start_dt,
                f"{date_field}__lt": end_dt,
            }
            queryset = queryset.filter(**filter_kwargs)

        filename = f"payments_export_{timezone.now().strftime('%Y%m%d')}.csv"
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        writer = csv.writer(response)
        writer.writerow([
            "id",
            "lease_id",
            "tenant_name",
            "amount",
            "status",
            "paid_at",
            "reference",
            "receipt_number",
            "created_at",
        ])

        for payment in queryset.select_related("lease").order_by("-created_at"):
            writer.writerow([
                payment.id,
                payment.lease_id,
                payment.lease.tenant_name,
                payment.amount,
                payment.status,
                payment.paid_at.isoformat() if payment.paid_at else "",
                payment.reference or "",
                payment.receipt_number or "",
                payment.created_at.isoformat(),
            ])

        return response


class FinanceDashboardView(AgencyScopedMixin, viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsAgencyMember]

    def _parse_period(self, request):
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        if start_date or end_date:
            if not start_date or not end_date:
                raise ValidationError("start_date et end_date sont requis ensemble.")
            try:
                start = datetime.strptime(start_date, "%Y-%m-%d").date()
                end = datetime.strptime(end_date, "%Y-%m-%d").date()
            except ValueError:
                raise ValidationError("Format de date invalide (YYYY-MM-DD).")
            if start > end:
                raise ValidationError("start_date doit etre avant end_date.")
            period_start = timezone.make_aware(datetime.combine(start, datetime.min.time()))
            period_end = timezone.make_aware(datetime.combine(end + timedelta(days=1), datetime.min.time()))
            return start, end, period_start, period_end, True

        now = timezone.now()
        month_start = _month_start(now)
        month_end = _add_months(month_start, 1)
        return (
            month_start.date(),
            (month_end - timedelta(days=1)).date(),
            month_start,
            month_end,
            False,
        )

    def _build_dashboard(self, request):
        agency = self.get_agency()
        period_start_date, period_end_date, period_start, period_end, is_custom = self._parse_period(request)

        payments_qs = Payment.objects.filter(
            agency=agency, status=PaymentStatus.PAID
        )
        period_collected = (
            payments_qs.filter(paid_at__gte=period_start, paid_at__lt=period_end)
            .aggregate(total=Sum("amount"))
            .get("total")
            or Decimal("0")
        )
        period_payments_qs = payments_qs.filter(
            paid_at__gte=period_start, paid_at__lt=period_end
        )
        payments_count = period_payments_qs.count()

        year_start_date = period_end_date.replace(month=1, day=1)
        year_start = timezone.make_aware(datetime.combine(year_start_date, datetime.min.time()))
        year_collected = (
            payments_qs.filter(paid_at__gte=year_start, paid_at__lt=period_end)
            .aggregate(total=Sum("amount"))
            .get("total")
            or Decimal("0")
        )

        active_leases = Lease.objects.filter(
            agency=agency, status=LeaseStatus.ACTIVE
        ).filter(
            start_date__lte=period_end_date,
        ).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=period_start_date)
        )
        rent_expected = (
            active_leases.aggregate(total=Sum("rent_amount")).get("total")
            or Decimal("0")
        )
        outstanding = rent_expected - period_collected
        if outstanding < 0:
            outstanding = Decimal("0")

        paid_lease_ids = period_payments_qs.values_list("lease_id", flat=True).distinct()
        overdue_leases = active_leases.exclude(id__in=paid_lease_ids)
        overdue_amount = (
            overdue_leases.aggregate(total=Sum("rent_amount")).get("total")
            or Decimal("0")
        )

        total_properties = Property.objects.filter(agency=agency).count()
        occupied_properties = (
            Property.objects.filter(
                agency=agency, leases__status=LeaseStatus.ACTIVE
            )
            .distinct()
            .count()
        )
        vacancy = max(total_properties - occupied_properties, 0)
        occupancy_rate = (
            (occupied_properties / total_properties) * 100
            if total_properties
            else 0.0
        )

        anchor_month = _month_start(
            timezone.make_aware(datetime.combine(period_end_date, datetime.min.time()))
        )
        months = []
        for i in range(5, -1, -1):
            period_start_month = _add_months(anchor_month, -i)
            period_end_month = _add_months(period_start_month, 1)
            total = (
                payments_qs.filter(
                    paid_at__gte=period_start_month, paid_at__lt=period_end_month
                )
                .aggregate(total=Sum("amount"))
                .get("total")
                or Decimal("0")
            )
            months.append(
                {
                    "month": period_start_month.strftime("%Y-%m"),
                    "revenue": _to_float(total),
                }
            )

        return {
            "currency": "XOF",
            "period": {
                "start_date": period_start_date.isoformat(),
                "end_date": period_end_date.isoformat(),
                "is_custom": is_custom,
            },
            "revenues": {
                "current_month": _to_float(period_collected),
                "year_to_date": _to_float(year_collected),
                "last_6_months": months,
            },
            "rent": {
                "expected_current_month": _to_float(rent_expected),
                "collected_current_month": _to_float(period_collected),
                "outstanding_current_month": _to_float(outstanding),
            },
            "payments": {
                "count_current_month": payments_count,
            },
            "overdue": {
                "leases_count": overdue_leases.count(),
                "amount": _to_float(overdue_amount),
            },
            "occupancy": {
                "total_properties": total_properties,
                "occupied_properties": occupied_properties,
                "vacant_properties": vacancy,
                "rate_percent": round(occupancy_rate, 2),
            },
            "leases": {
                "active_count": active_leases.count(),
            },
        }

    def list(self, request, *args, **kwargs):
        data = self._build_dashboard(request)
        return Response(data)

    def export(self, request, *args, **kwargs):
        data = self._build_dashboard(request)
        filename = f"finance_dashboard_{data['period']['start_date']}_to_{data['period']['end_date']}.csv"

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow(["metric", "value"])
        writer.writerow(["currency", data["currency"]])
        writer.writerow(["period_start", data["period"]["start_date"]])
        writer.writerow(["period_end", data["period"]["end_date"]])
        writer.writerow(["current_month", data["revenues"]["current_month"]])
        writer.writerow(["year_to_date", data["revenues"]["year_to_date"]])
        writer.writerow(["expected_current_month", data["rent"]["expected_current_month"]])
        writer.writerow(["collected_current_month", data["rent"]["collected_current_month"]])
        writer.writerow(["outstanding_current_month", data["rent"]["outstanding_current_month"]])
        writer.writerow(["total_properties", data["occupancy"]["total_properties"]])
        writer.writerow(["occupied_properties", data["occupancy"]["occupied_properties"]])
        writer.writerow(["vacant_properties", data["occupancy"]["vacant_properties"]])
        writer.writerow(["occupancy_rate_percent", data["occupancy"]["rate_percent"]])
        writer.writerow(["active_leases", data["leases"]["active_count"]])
        writer.writerow([])
        writer.writerow(["month", "revenue"])
        for item in data["revenues"]["last_6_months"]:
            writer.writerow([item["month"], item["revenue"]])

        return response
