from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.agencies.models import Agency, AgencyMembership, AgencyRole

from .models import AgencyInvoice, AgencySubscription, Plan, SubscriptionStatus
from .services.cinetpay import CinetPayClient

User = get_user_model()


@pytest.fixture()
def api_client():
    return APIClient()


@pytest.fixture()
def user_password():
    return "S3cretPass#123"


def _create_user(phone, email, password, full_name="Test User"):
    return User.objects.create_user(
        phone_number=phone,
        full_name=full_name,
        email=email,
        password=password,
    )


def _login(api_client, login, password, agency_id=None):
    payload = {"login": login, "password": password}
    if agency_id:
        payload["agency_id"] = str(agency_id)
    response = api_client.post("/api/v1/auth/jwt/create/", payload, format="json")
    assert response.status_code == 200
    return response.data["access"]


@pytest.mark.django_db
def test_public_can_list_plans(api_client):
    Plan.objects.create(
        name="Starter",
        code="starter",
        price_monthly="10000",
        currency="XOF",
        is_active=True,
    )
    response = api_client.get("/api/v1/billing/plans/")
    assert response.status_code == 200
    assert len(response.data) == 1


@pytest.mark.django_db
def test_owner_can_create_subscription_and_invoice(api_client, user_password):
    plan = Plan.objects.create(
        name="Pro",
        code="pro",
        price_monthly="30000",
        currency="XOF",
        is_active=True,
    )
    owner = _create_user("0700000800", "owner-billing@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Billing", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = api_client.post(
        "/api/v1/billing/subscription/",
        {"plan_id": str(plan.id), "billing_cycle": "monthly"},
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert response.status_code == 201
    assert response.data["subscription"]["plan"]["code"] == "pro"
    assert float(response.data["invoice"]["amount"]) == 30000.0


@pytest.mark.django_db
def test_owner_can_list_invoices_and_mark_paid(api_client, user_password):
    plan = Plan.objects.create(
        name="Starter",
        code="starter",
        price_monthly="10000",
        currency="XOF",
        is_active=True,
    )
    owner = _create_user("0700000801", "owner-invoice@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Invoice", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    create = api_client.post(
        "/api/v1/billing/subscription/",
        {"plan_id": str(plan.id), "billing_cycle": "monthly"},
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert create.status_code == 201
    invoice_id = create.data["invoice"]["id"]

    listing = api_client.get(
        "/api/v1/billing/invoices/", HTTP_X_AGENCY_ID=str(agency.id)
    )
    assert listing.status_code == 200
    assert len(listing.data) == 1

    paid = api_client.post(
        f"/api/v1/billing/invoices/{invoice_id}/pay/",
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert paid.status_code == 200
    assert paid.data["status"] == "paid"


@pytest.mark.django_db
def test_invoice_pdf_endpoint(api_client, user_password):
    plan = Plan.objects.create(
        name="Pdf",
        code="pdf",
        price_monthly="15000",
        currency="XOF",
        is_active=True,
    )
    owner = _create_user("0700000810", "owner-pdf@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence PDF", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    create = api_client.post(
        "/api/v1/billing/subscription/",
        {"plan_id": str(plan.id), "billing_cycle": "monthly"},
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    invoice_id = create.data["invoice"]["id"]

    response = api_client.get(
        f"/api/v1/billing/invoices/{invoice_id}/pdf/",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert response.status_code == 200
    assert "application/pdf" in response["Content-Type"]


@pytest.mark.django_db
@override_settings(CINETPAY_ENABLED=True, CINETPAY_API_KEY="key", CINETPAY_SITE_ID="site")
def test_invoice_checkout_creates_payment_url(api_client, user_password, monkeypatch):
    plan = Plan.objects.create(
        name="Checkout",
        code="checkout",
        price_monthly="20000",
        currency="XOF",
        is_active=True,
    )
    owner = _create_user("0700000811", "owner-checkout@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Checkout", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    create = api_client.post(
        "/api/v1/billing/subscription/",
        {"plan_id": str(plan.id), "billing_cycle": "monthly"},
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    invoice_id = create.data["invoice"]["id"]

    monkeypatch.setattr(
        CinetPayClient,
        "create_payment",
        lambda *args, **kwargs: {"code": "201", "message": "CREATED", "data": {"payment_url": "https://pay.test/123"}},
    )

    response = api_client.post(
        f"/api/v1/billing/invoices/{invoice_id}/checkout/",
        {"customer_email": owner.email, "customer_phone": owner.phone_number},
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert response.status_code == 200
    assert response.data["payment_url"] == "https://pay.test/123"


@pytest.mark.django_db
@override_settings(CINETPAY_SITE_ID="site", CINETPAY_API_KEY="key")
def test_cinetpay_webhook_marks_invoice_paid(api_client, user_password, monkeypatch):
    plan = Plan.objects.create(
        name="Webhook",
        code="webhook",
        price_monthly="25000",
        currency="XOF",
        is_active=True,
    )
    owner = _create_user("0700000812", "owner-hook@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Webhook", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    create = api_client.post(
        "/api/v1/billing/subscription/",
        {"plan_id": str(plan.id), "billing_cycle": "monthly"},
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    invoice_id = create.data["invoice"]["id"]
    invoice = AgencyInvoice.objects.get(id=invoice_id)
    invoice.provider_reference = "TX-123"
    invoice.provider = "cinetpay"
    invoice.save(update_fields=["provider_reference", "provider"])

    monkeypatch.setattr(
        CinetPayClient,
        "check_transaction",
        lambda *args, **kwargs: {
            "code": "00",
            "data": {"status": "ACCEPTED", "amount": "25000", "currency": "XOF"},
        },
    )

    webhook = api_client.post(
        "/api/v1/billing/cinetpay/webhook/",
        {"cpm_trans_id": "TX-123", "cpm_site_id": "site"},
        format="json",
    )
    assert webhook.status_code == 200
    invoice.refresh_from_db()
    assert invoice.status == "paid"


@pytest.mark.django_db
def test_expire_trials_command_creates_invoice(api_client, user_password):
    plan = Plan.objects.create(
        name="Trial",
        code="trial",
        price_monthly="5000",
        currency="XOF",
        is_active=True,
    )
    owner = _create_user("0700000813", "owner-trial@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Trial", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    subscription = AgencySubscription.objects.create(
        agency=agency,
        plan=plan,
        status=SubscriptionStatus.TRIALING,
        billing_cycle="monthly",
        trial_end=timezone.now() - timedelta(days=1),
        current_period_start=timezone.now(),
        current_period_end=timezone.now() + timedelta(days=30),
    )

    call_command("expire_trials")
    subscription.refresh_from_db()
    assert subscription.status == SubscriptionStatus.PAST_DUE
    assert AgencyInvoice.objects.filter(subscription=subscription).exists()
