from datetime import timedelta
from decimal import Decimal
from io import BytesIO
import uuid

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from apps.agencies.mixins import AgencyScopedMixin
from apps.agencies.permissions import IsAgencyOwnerOrManager

from .models import (
    AgencyInvoice,
    AgencySubscription,
    BillingCycle,
    InvoiceStatus,
    Plan,
    SubscriptionStatus,
)
from .serializers import InvoiceSerializer, PlanSerializer, SubscriptionSerializer
from .services.cinetpay import CinetPayClient, CinetPayError


class PlanViewSet(viewsets.ModelViewSet):
    queryset = Plan.objects.all()
    serializer_class = PlanSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAdminUser()]

    def get_queryset(self):
        if self.action in ("list", "retrieve"):
            return Plan.objects.filter(is_active=True)
        return super().get_queryset()


class SubscriptionViewSet(AgencyScopedMixin, viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsAgencyOwnerOrManager]

    def list(self, request, *args, **kwargs):
        agency = self.get_agency()
        subscription = AgencySubscription.objects.filter(agency=agency).first()
        if not subscription:
            return Response({"detail": "Aucun abonnement actif."}, status=status.HTTP_404_NOT_FOUND)
        serializer = SubscriptionSerializer(subscription)
        return Response(serializer.data)

    def _resolve_plan(self, data):
        plan_id = data.get("plan_id") or data.get("plan")
        plan_code = data.get("plan_code")
        if plan_id:
            plan = Plan.objects.filter(id=plan_id, is_active=True).first()
        elif plan_code:
            plan = Plan.objects.filter(code=plan_code, is_active=True).first()
        else:
            plan = None
        if not plan:
            raise ValidationError("Plan invalide ou inactif.")
        return plan

    def _compute_amount(self, plan, billing_cycle):
        if billing_cycle == BillingCycle.YEARLY:
            if plan.price_yearly is not None:
                return plan.price_yearly
            return plan.price_monthly * 12
        return plan.price_monthly

    def _create_invoice(self, subscription, amount):
        now = timezone.now()
        period_start = subscription.current_period_start.date()
        period_end = subscription.current_period_end.date()
        invoice = AgencyInvoice.objects.create(
            agency=subscription.agency,
            subscription=subscription,
            amount=amount,
            currency=subscription.plan.currency,
            status=InvoiceStatus.PAID if amount == 0 else InvoiceStatus.ISSUED,
            period_start=period_start,
            period_end=period_end,
            issued_at=now,
            due_at=now + timedelta(days=7),
            paid_at=now if amount == 0 else None,
        )
        return invoice

    def create(self, request, *args, **kwargs):
        agency = self.get_agency()
        plan = self._resolve_plan(request.data)
        billing_cycle = request.data.get("billing_cycle", BillingCycle.MONTHLY)
        if billing_cycle not in BillingCycle.values:
            raise ValidationError("billing_cycle invalide.")

        trial_days = int(request.data.get("trial_days", 0) or 0)
        now = timezone.now()

        subscription, created = AgencySubscription.objects.get_or_create(
            agency=agency,
            defaults={
                "plan": plan,
                "billing_cycle": billing_cycle,
                "status": SubscriptionStatus.TRIALING if trial_days else SubscriptionStatus.ACTIVE,
                "started_at": now,
            },
        )

        if not created:
            subscription.plan = plan
            subscription.billing_cycle = billing_cycle
            subscription.status = (
                SubscriptionStatus.TRIALING if trial_days else SubscriptionStatus.ACTIVE
            )

        subscription.set_period(start=now)
        if trial_days:
            subscription.trial_end = now + timedelta(days=trial_days)
        else:
            subscription.trial_end = None
        subscription.ended_at = None
        subscription.cancel_at_period_end = False
        subscription.save()

        amount = self._compute_amount(plan, billing_cycle)
        invoice = self._create_invoice(subscription, amount)

        serializer = SubscriptionSerializer(subscription)
        return Response(
            {
                "subscription": serializer.data,
                "invoice": InvoiceSerializer(invoice).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="cancel")
    def cancel(self, request, *args, **kwargs):
        agency = self.get_agency()
        subscription = AgencySubscription.objects.filter(agency=agency).first()
        if not subscription:
            return Response({"detail": "Aucun abonnement actif."}, status=status.HTTP_404_NOT_FOUND)
        immediate = bool(request.data.get("immediate", False))
        if immediate:
            subscription.status = SubscriptionStatus.CANCELED
            subscription.ended_at = timezone.now()
            subscription.cancel_at_period_end = False
        else:
            subscription.cancel_at_period_end = True
        subscription.save()
        return Response(SubscriptionSerializer(subscription).data)

    @action(detail=False, methods=["post"], url_path="resume")
    def resume(self, request, *args, **kwargs):
        agency = self.get_agency()
        subscription = AgencySubscription.objects.filter(agency=agency).first()
        if not subscription:
            return Response({"detail": "Aucun abonnement actif."}, status=status.HTTP_404_NOT_FOUND)
        subscription.cancel_at_period_end = False
        if subscription.status == SubscriptionStatus.CANCELED:
            subscription.status = SubscriptionStatus.ACTIVE
            subscription.ended_at = None
        subscription.save()
        return Response(SubscriptionSerializer(subscription).data)


class InvoiceViewSet(AgencyScopedMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsAgencyOwnerOrManager]

    def get_queryset(self):
        return AgencyInvoice.objects.filter(agency=self.get_agency())

    def _render_invoice_pdf(self, invoice):
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        agency = invoice.agency
        subscription = invoice.subscription
        plan = subscription.plan

        y = height - 60
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, y, "Facture d'abonnement")
        y -= 30

        c.setFont("Helvetica", 10)
        c.drawString(50, y, f"Agence: {agency.name}")
        y -= 15
        c.drawString(50, y, f"Plan: {plan.name}")
        y -= 15
        c.drawString(50, y, f"Facture: {invoice.number}")
        y -= 15
        c.drawString(50, y, f"Periode: {invoice.period_start} -> {invoice.period_end}")
        y -= 15
        c.drawString(50, y, f"Statut: {invoice.status}")
        y -= 30

        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, y, f"Montant: {invoice.amount} {invoice.currency}")
        y -= 15
        c.setFont("Helvetica", 10)
        c.drawString(50, y, f"Emise le: {invoice.issued_at.strftime('%Y-%m-%d') if invoice.issued_at else '-'}")
        y -= 15
        c.drawString(50, y, f"Due le: {invoice.due_at.strftime('%Y-%m-%d') if invoice.due_at else '-'}")
        y -= 15
        c.drawString(50, y, f"Payee le: {invoice.paid_at.strftime('%Y-%m-%d') if invoice.paid_at else '-'}")

        c.showPage()
        c.save()
        pdf = buffer.getvalue()
        buffer.close()
        return pdf

    @action(detail=True, methods=["post"], url_path="pay")
    def pay(self, request, *args, **kwargs):
        invoice = self.get_object()
        invoice.status = InvoiceStatus.PAID
        invoice.paid_at = timezone.now()
        invoice.save(update_fields=["status", "paid_at", "updated_at"])
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, *args, **kwargs):
        invoice = self.get_object()
        pdf_bytes = self._render_invoice_pdf(invoice)
        filename = f"invoice_{invoice.number}.pdf"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="{filename}"'
        return response

    @action(detail=True, methods=["post"], url_path="checkout")
    def checkout(self, request, *args, **kwargs):
        if not getattr(settings, "CINETPAY_ENABLED", False):
            raise ValidationError("CINETPAY est desactive.")

        invoice = self.get_object()
        if invoice.status == InvoiceStatus.PAID:
            raise ValidationError("Facture deja payee.")
        if invoice.amount <= 0:
            raise ValidationError("Montant invalide.")

        transaction_id = invoice.provider_reference or uuid.uuid4().hex
        invoice.provider = "cinetpay"
        invoice.provider_reference = transaction_id

        amount = invoice.amount
        if isinstance(amount, Decimal):
            amount_value = int(amount)
        else:
            amount_value = int(float(amount))
        if amount_value % 5 != 0 and invoice.currency.upper() in ("XOF", "XAF"):
            raise ValidationError("Le montant doit etre multiple de 5 pour XOF/XAF.")

        user = request.user
        full_name = getattr(user, "full_name", "") or getattr(user, "email", "") or "Customer"
        name_parts = full_name.split()
        customer_name = name_parts[0] if name_parts else "Customer"
        customer_surname = " ".join(name_parts[1:]) if len(name_parts) > 1 else customer_name

        customer_email = request.data.get("customer_email") or getattr(user, "email", "")
        customer_phone = request.data.get("customer_phone") or getattr(user, "phone_number", "")
        if not customer_email:
            raise ValidationError("customer_email requis.")
        if not customer_phone:
            raise ValidationError("customer_phone requis.")

        customer = {
            "name": customer_name,
            "surname": customer_surname,
            "email": customer_email,
            "phone": customer_phone,
            "address": request.data.get("customer_address"),
            "city": request.data.get("customer_city"),
            "country": request.data.get("customer_country"),
            "state": request.data.get("customer_state"),
            "zip": request.data.get("customer_zip"),
        }

        description = f"Abonnement RentFlow - {invoice.subscription.plan.name}"
        client = CinetPayClient()
        try:
            response = client.create_payment(
                transaction_id=transaction_id,
                amount=amount_value,
                currency=invoice.currency,
                description=description,
                customer=customer,
            )
        except CinetPayError as exc:
            raise ValidationError(str(exc))

        invoice.provider_status = response.get("message", "") or response.get("code", "")
        invoice.provider_payload = response
        invoice.payment_url = response.get("data", {}).get("payment_url") or ""
        invoice.save(
            update_fields=[
                "provider",
                "provider_reference",
                "provider_status",
                "provider_payload",
                "payment_url",
                "updated_at",
            ]
        )

        return Response(
            {
                "transaction_id": transaction_id,
                "payment_url": invoice.payment_url,
                "invoice": InvoiceSerializer(invoice).data,
            }
        )


class CinetPayWebhookView(viewsets.ViewSet):
    authentication_classes = []
    permission_classes = [AllowAny]

    def list(self, request, *args, **kwargs):
        return Response({"detail": "ok"})

    def create(self, request, *args, **kwargs):
        payload = request.data
        transaction_id = payload.get("cpm_trans_id") or payload.get("transaction_id")
        site_id = payload.get("cpm_site_id") or payload.get("site_id")
        if not transaction_id:
            return Response({"detail": "transaction_id requis."}, status=400)

        invoice = AgencyInvoice.objects.filter(provider_reference=transaction_id).first()
        if not invoice:
            return Response({"detail": "Facture introuvable."}, status=404)

        if site_id and getattr(settings, "CINETPAY_SITE_ID", "") and site_id != settings.CINETPAY_SITE_ID:
            return Response({"detail": "site_id invalide."}, status=400)

        client = CinetPayClient()
        token = request.headers.get("X-Token") or request.headers.get("x-token")
        if client.secret_key and token:
            valid = client.verify_hmac(payload, token)
            if valid is False:
                return Response({"detail": "Signature invalide."}, status=400)

        try:
            check = client.check_transaction(transaction_id)
        except CinetPayError:
            return Response({"detail": "Verification CinetPay echouee."}, status=400)

        data = check.get("data") or {}
        status_code = check.get("code")
        provider_status = data.get("status") or check.get("message", "")
        invoice.provider_status = provider_status
        invoice.provider_payload = check

        if status_code == "00" and provider_status == "ACCEPTED":
            amount = Decimal(str(data.get("amount", invoice.amount)))
            currency = data.get("currency") or invoice.currency
            if amount == invoice.amount and currency == invoice.currency:
                invoice.status = InvoiceStatus.PAID
                invoice.paid_at = timezone.now()
                subscription = invoice.subscription
                subscription.status = SubscriptionStatus.ACTIVE
                subscription.cancel_at_period_end = False
                subscription.ended_at = None
                subscription.save(update_fields=["status", "cancel_at_period_end", "ended_at", "updated_at"])
        invoice.save(update_fields=["status", "paid_at", "provider_status", "provider_payload", "updated_at"])
        return Response({"detail": "ok"})
