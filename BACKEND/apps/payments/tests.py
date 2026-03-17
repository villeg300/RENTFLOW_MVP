import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone
from django.test import override_settings
from rest_framework.test import APIClient

from apps.agencies.models import Agency, AgencyMembership, AgencyRole
from apps.leases.models import Lease
from apps.payments.models import Payment
from apps.properties.models import Property

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
def test_payment_requires_lease_in_same_agency(api_client, user_password):
    user = _create_user("0700000400", "owner@example.com", user_password, "Owner")
    agency_a = Agency.objects.create(name="Agence A", created_by=user)
    agency_b = Agency.objects.create(name="Agence B", created_by=user)
    AgencyMembership.objects.create(agency=agency_a, user=user, role=AgencyRole.OWNER)
    AgencyMembership.objects.create(agency=agency_b, user=user, role=AgencyRole.OWNER)

    property_a = Property.objects.create(
        agency=agency_a,
        title="Villa A",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="250000",
        is_available=True,
    )
    lease_a = Lease.objects.create(
        agency=agency_a,
        property=property_a,
        tenant_name="Abdou",
        tenant_phone="70112233",
        tenant_email="abdou@example.com",
        start_date="2026-04-01",
        rent_amount="250000",
        deposit_amount="250000",
    )

    access = _login(api_client, user.phone_number, user_password, agency_id=agency_b.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    bad_response = api_client.post(
        "/api/v1/payments/",
        {
            "lease": str(lease_a.id),
            "amount": "250000",
            "status": "paid",
            "reference": "CASH-001",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency_b.id),
    )
    assert bad_response.status_code == 400
    assert "lease" in bad_response.data

    good_response = api_client.post(
        "/api/v1/payments/",
        {
            "lease": str(lease_a.id),
            "amount": "250000",
            "status": "paid",
            "reference": "CASH-001",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency_a.id),
    )
    assert good_response.status_code == 201


@pytest.mark.django_db
def test_viewer_cannot_create_payment(api_client, user_password):
    owner = _create_user("0700000600", "owner2@example.com", user_password, "Owner")
    viewer = _create_user("0700000601", "viewer2@example.com", user_password, "Viewer")
    agency = Agency.objects.create(name="Agence Viewer Pay", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)
    AgencyMembership.objects.create(agency=agency, user=viewer, role=AgencyRole.VIEWER)

    property_a = Property.objects.create(
        agency=agency,
        title="Villa A",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="250000",
        is_available=True,
    )
    lease_a = Lease.objects.create(
        agency=agency,
        property=property_a,
        tenant_name="Abdou",
        tenant_phone="70112233",
        tenant_email="abdou@example.com",
        start_date="2026-04-01",
        rent_amount="250000",
        deposit_amount="250000",
    )

    viewer_access = _login(api_client, viewer.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {viewer_access}")

    response = api_client.post(
        "/api/v1/payments/",
        {
            "lease": str(lease_a.id),
            "amount": "250000",
            "status": "paid",
            "reference": "CASH-001",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_finance_dashboard_metrics(api_client, user_password):
    owner = _create_user("0700000700", "owner3@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Finance", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    property_a = Property.objects.create(
        agency=agency,
        title="Villa A",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="100000",
        is_available=True,
    )
    property_b = Property.objects.create(
        agency=agency,
        title="Villa B",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="200000",
        is_available=True,
    )
    Property.objects.create(
        agency=agency,
        title="Villa C",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="150000",
        is_available=True,
    )

    lease_a = Lease.objects.create(
        agency=agency,
        property=property_a,
        tenant_name="Abdou",
        tenant_phone="70112233",
        tenant_email="abdou@example.com",
        start_date=timezone.now().date(),
        rent_amount="100000",
        deposit_amount="100000",
    )
    Lease.objects.create(
        agency=agency,
        property=property_b,
        tenant_name="Awa",
        tenant_phone="70112244",
        tenant_email="awa@example.com",
        start_date=timezone.now().date(),
        rent_amount="200000",
        deposit_amount="200000",
    )

    Payment.objects.create(
        agency=agency,
        lease=lease_a,
        amount="100000",
        status="paid",
        paid_at=timezone.now(),
    )

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = api_client.get(
        "/api/v1/dashboard/finance/", HTTP_X_AGENCY_ID=str(agency.id)
    )
    assert response.status_code == 200
    data = response.data

    assert data["revenues"]["current_month"] == 100000.0
    assert data["rent"]["expected_current_month"] == 300000.0
    assert data["rent"]["outstanding_current_month"] == 200000.0
    assert data["occupancy"]["total_properties"] == 3
    assert data["occupancy"]["occupied_properties"] == 2
    assert data["occupancy"]["vacant_properties"] == 1
    assert len(data["revenues"]["last_6_months"]) == 6


@pytest.mark.django_db
def test_finance_dashboard_custom_period_and_export(api_client, user_password):
    owner = _create_user("0700000701", "owner4@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Finance 2", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    property_a = Property.objects.create(
        agency=agency,
        title="Villa P",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="100000",
        is_available=True,
    )
    lease = Lease.objects.create(
        agency=agency,
        property=property_a,
        tenant_name="Abdou",
        tenant_phone="70112233",
        tenant_email="abdou@example.com",
        start_date=timezone.datetime(2026, 1, 5).date(),
        rent_amount="100000",
        deposit_amount="100000",
    )
    Payment.objects.create(
        agency=agency,
        lease=lease,
        amount="80000",
        status="paid",
        paid_at=timezone.make_aware(timezone.datetime(2026, 1, 15)),
    )

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = api_client.get(
        "/api/v1/dashboard/finance/?start_date=2026-01-01&end_date=2026-01-31",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert response.status_code == 200
    data = response.data
    assert data["revenues"]["current_month"] == 80000.0
    assert data["rent"]["expected_current_month"] == 100000.0
    assert data["rent"]["outstanding_current_month"] == 20000.0
    assert data["period"]["is_custom"] is True

    export = api_client.get(
        "/api/v1/dashboard/finance/export/?start_date=2026-01-01&end_date=2026-01-31",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert export.status_code == 200
    assert "text/csv" in export["Content-Type"]
    assert "current_month" in export.content.decode("utf-8")


@pytest.mark.django_db
@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
def test_payment_receipt_download_and_send(api_client, user_password):
    owner = _create_user("0700000702", "owner5@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Receipt", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    property_a = Property.objects.create(
        agency=agency,
        title="Villa R",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="100000",
        is_available=True,
    )
    lease = Lease.objects.create(
        agency=agency,
        property=property_a,
        tenant_name="Awa",
        tenant_phone="70112233",
        tenant_email="awa@example.com",
        start_date=timezone.now().date(),
        rent_amount="100000",
        deposit_amount="100000",
    )
    payment = Payment.objects.create(
        agency=agency,
        lease=lease,
        amount="100000",
        status="paid",
        paid_at=timezone.now(),
    )

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    receipt = api_client.get(
        f"/api/v1/payments/{payment.id}/receipt/",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert receipt.status_code == 200
    assert "application/pdf" in receipt["Content-Type"]

    send = api_client.post(
        f"/api/v1/payments/{payment.id}/receipt/send/",
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert send.status_code == 200
    assert len(mail.outbox) == 1
    assert "Quittance de loyer" in mail.outbox[0].subject


@pytest.mark.django_db
@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    PAYMENT_AUTO_SEND_RECEIPT=True,
)
def test_payment_auto_send_receipt(api_client, user_password):
    owner = _create_user("0700000703", "owner6@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Auto", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    property_a = Property.objects.create(
        agency=agency,
        title="Villa Auto",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="100000",
        is_available=True,
    )
    lease = Lease.objects.create(
        agency=agency,
        property=property_a,
        tenant_name="Salif",
        tenant_phone="70112288",
        tenant_email="salif@example.com",
        start_date=timezone.now().date(),
        rent_amount="100000",
        deposit_amount="100000",
    )

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = api_client.post(
        "/api/v1/payments/",
        {
            "lease": str(lease.id),
            "amount": "100000",
            "status": "paid",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert response.status_code == 201
    assert len(mail.outbox) == 1


@pytest.mark.django_db
def test_payment_export_csv(api_client, user_password):
    owner = _create_user("0700000900", "owner-export@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Export", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    property_a = Property.objects.create(
        agency=agency,
        title="Villa Export",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="120000",
        is_available=True,
    )
    lease_a = Lease.objects.create(
        agency=agency,
        property=property_a,
        tenant_name="Awa",
        tenant_phone="70112299",
        tenant_email="awa-export@example.com",
        start_date=timezone.now().date(),
        rent_amount="120000",
        deposit_amount="120000",
    )
    Payment.objects.create(
        agency=agency,
        lease=lease_a,
        amount="120000",
        status="paid",
        paid_at=timezone.now(),
    )

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    today = timezone.now().date().isoformat()
    response = api_client.get(
        f"/api/v1/payments/export/?start_date={today}&end_date={today}&status=paid",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert response.status_code == 200
    assert "text/csv" in response["Content-Type"]
    assert "lease_id" in response.content.decode("utf-8")
