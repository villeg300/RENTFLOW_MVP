import pytest
from django.core import mail
from django.test import override_settings
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.agencies.models import Agency, AgencyMembership, AgencyRole
from apps.leases.models import Lease
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
def test_lease_requires_property_in_same_agency(api_client, user_password):
    user = _create_user("0700000300", "owner@example.com", user_password, "Owner")
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

    access = _login(api_client, user.phone_number, user_password, agency_id=agency_b.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    bad_response = api_client.post(
        "/api/v1/leases/",
        {
            "property": str(property_a.id),
            "tenant_name": "Abdou",
            "tenant_phone": "70112233",
            "tenant_email": "abdou@example.com",
            "start_date": "2026-04-01",
            "rent_amount": "250000",
            "deposit_amount": "250000",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency_b.id),
    )
    assert bad_response.status_code == 400
    assert "property" in bad_response.data

    good_response = api_client.post(
        "/api/v1/leases/",
        {
            "property": str(property_a.id),
            "tenant_name": "Abdou",
            "tenant_phone": "70112233",
            "tenant_email": "abdou@example.com",
            "start_date": "2026-04-01",
            "rent_amount": "250000",
            "deposit_amount": "250000",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency_a.id),
    )
    assert good_response.status_code == 201


@pytest.mark.django_db
def test_viewer_cannot_create_lease(api_client, user_password):
    owner = _create_user("0700000500", "owner2@example.com", user_password, "Owner")
    viewer = _create_user("0700000501", "viewer2@example.com", user_password, "Viewer")
    agency = Agency.objects.create(name="Agence Viewer Lease", created_by=owner)
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

    viewer_access = _login(api_client, viewer.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {viewer_access}")

    response = api_client.post(
        "/api/v1/leases/",
        {
            "property": str(property_a.id),
            "tenant_name": "Abdou",
            "tenant_phone": "70112233",
            "tenant_email": "abdou@example.com",
            "start_date": "2026-04-01",
            "rent_amount": "250000",
            "deposit_amount": "250000",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_tenant_create_and_scope(api_client, user_password):
    owner = _create_user("0700000600", "owner3@example.com", user_password, "Owner")
    agency_a = Agency.objects.create(name="Agence A", created_by=owner)
    agency_b = Agency.objects.create(name="Agence B", created_by=owner)
    AgencyMembership.objects.create(agency=agency_a, user=owner, role=AgencyRole.OWNER)
    AgencyMembership.objects.create(agency=agency_b, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency_a.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    create = api_client.post(
        "/api/v1/tenants/",
        {
            "full_name": "Awa Traore",
            "phone_number": "70112233",
            "email": "awa@example.com",
            "address": "Ouaga",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency_a.id),
    )
    assert create.status_code == 201

    list_a = api_client.get("/api/v1/tenants/", HTTP_X_AGENCY_ID=str(agency_a.id))
    assert list_a.status_code == 200
    assert len(list_a.data["results"]) == 1
    assert list_a.data["results"][0]["leases_count"] == 0

    list_b = api_client.get("/api/v1/tenants/", HTTP_X_AGENCY_ID=str(agency_b.id))
    assert list_b.status_code == 200
    assert len(list_b.data["results"]) == 0


@pytest.mark.django_db
def test_viewer_cannot_create_tenant(api_client, user_password):
    owner = _create_user("0700000601", "owner4@example.com", user_password, "Owner")
    viewer = _create_user("0700000602", "viewer4@example.com", user_password, "Viewer")
    agency = Agency.objects.create(name="Agence Viewer Tenant", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)
    AgencyMembership.objects.create(agency=agency, user=viewer, role=AgencyRole.VIEWER)

    viewer_access = _login(api_client, viewer.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {viewer_access}")

    response = api_client.post(
        "/api/v1/tenants/",
        {"full_name": "Test", "phone_number": "70001122"},
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_lease_with_tenant_autofills_snapshot(api_client, user_password):
    owner = _create_user("0700000603", "owner5@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Tenant Lease", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    property_a = Property.objects.create(
        agency=agency,
        title="Villa A",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="250000",
        is_available=True,
    )

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    tenant = api_client.post(
        "/api/v1/tenants/",
        {
            "full_name": "Abdou",
            "phone_number": "70112244",
            "email": "abdou@example.com",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert tenant.status_code == 201

    lease = api_client.post(
        "/api/v1/leases/",
        {
            "property": str(property_a.id),
            "tenant": tenant.data["id"],
            "start_date": "2026-04-01",
            "rent_amount": "250000",
            "deposit_amount": "250000",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert lease.status_code == 201
    assert lease.data["tenant_name"] == "Abdou"
    assert lease.data["tenant_phone"] == "70112244"
    assert lease.data["tenant_email"] == "abdou@example.com"

    tenant_detail = api_client.get(
        f"/api/v1/tenants/{tenant.data['id']}/",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert tenant_detail.status_code == 200
    assert "leases" in tenant_detail.data
    assert len(tenant_detail.data["leases"]) == 1
    assert tenant_detail.data["leases"][0]["id"] == lease.data["id"]


@pytest.mark.django_db
def test_tenant_filters(api_client, user_password):
    owner = _create_user("0700000604", "owner6@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Filters", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    api_client.post(
        "/api/v1/tenants/",
        {
            "full_name": "Awa Traore",
            "phone_number": "70110011",
            "email": "awa@example.com",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    api_client.post(
        "/api/v1/tenants/",
        {
            "full_name": "Issa Zongo",
            "phone_number": "70110022",
            "email": "issa@example.com",
            "is_active": False,
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )

    by_q = api_client.get("/api/v1/tenants/?q=awa", HTTP_X_AGENCY_ID=str(agency.id))
    assert by_q.status_code == 200
    assert len(by_q.data["results"]) == 1

    by_phone = api_client.get(
        "/api/v1/tenants/?phone=022", HTTP_X_AGENCY_ID=str(agency.id)
    )
    assert len(by_phone.data["results"]) == 1

    by_active = api_client.get(
        "/api/v1/tenants/?is_active=false", HTTP_X_AGENCY_ID=str(agency.id)
    )
    assert len(by_active.data["results"]) == 1


@pytest.mark.django_db
def test_tenant_history_endpoint(api_client, user_password):
    owner = _create_user("0700000605", "owner7@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence History", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    property_a = Property.objects.create(
        agency=agency,
        title="Villa H",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="250000",
        is_available=True,
    )

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    tenant = api_client.post(
        "/api/v1/tenants/",
        {
            "full_name": "Fatou",
            "phone_number": "70119999",
            "email": "fatou@example.com",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert tenant.status_code == 201

    lease = api_client.post(
        "/api/v1/leases/",
        {
            "property": str(property_a.id),
            "tenant": tenant.data["id"],
            "start_date": "2026-05-01",
            "rent_amount": "250000",
            "deposit_amount": "250000",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert lease.status_code == 201

    payment = api_client.post(
        "/api/v1/payments/",
        {
            "lease": lease.data["id"],
            "amount": "250000",
            "status": "paid",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert payment.status_code == 201

    history = api_client.get(
        f"/api/v1/tenants/{tenant.data['id']}/history/",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert history.status_code == 200
    assert "tenant" in history.data
    assert history.data["leases"]["count"] == 1
    assert history.data["payments"]["count"] == 1
    assert len(history.data["leases"]["results"]) == 1
    assert len(history.data["payments"]["results"]) == 1

    paginated = api_client.get(
        f"/api/v1/tenants/{tenant.data['id']}/history/?leases_page_size=1&payments_page_size=1",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert paginated.status_code == 200
    assert len(paginated.data["leases"]["results"]) == 1
    assert len(paginated.data["payments"]["results"]) == 1


@pytest.mark.django_db
def test_tenant_preferences_endpoint(api_client, user_password):
    owner = _create_user("0700000606", "owner8@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Pref", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    tenant = api_client.post(
        "/api/v1/tenants/",
        {
            "full_name": "Karim",
            "phone_number": "70001199",
            "email": "karim@example.com",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert tenant.status_code == 201

    update = api_client.patch(
        f"/api/v1/tenants/{tenant.data['id']}/preferences/",
        {"allow_sms": False, "remind_days": "-5,0,5"},
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert update.status_code == 200
    assert update.data["allow_sms"] is False
    assert update.data["remind_days"] == "-5,0,5"

    detail = api_client.get(
        f"/api/v1/tenants/{tenant.data['id']}/preferences/",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert detail.status_code == 200
    assert detail.data["allow_sms"] is False


@pytest.mark.django_db
@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    SMS_SIMULATE=True,
    WHATSAPP_SIMULATE=True,
)
def test_manual_reminder_endpoint(api_client, user_password):
    owner = _create_user("0700000607", "owner9@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Remind", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    property_a = Property.objects.create(
        agency=agency,
        title="Villa M",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="100000",
        is_available=True,
    )
    lease = Lease.objects.create(
        agency=agency,
        property=property_a,
        tenant_name="Nana",
        tenant_phone="70112277",
        tenant_email="nana@example.com",
        start_date=timezone.localdate(),
        rent_amount="100000",
        deposit_amount="100000",
    )

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = api_client.post(
        f"/api/v1/leases/{lease.id}/remind/",
        {"channels": ["email"], "message": "Test rappel"},
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert response.status_code == 200
    assert len(mail.outbox) == 1


@pytest.mark.django_db
@override_settings(
    WHATSAPP_SIMULATE=True,
)
def test_whatsapp_verification_flow(api_client, user_password, monkeypatch):
    owner = _create_user("0700000608", "owner10@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence WA", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    tenant = api_client.post(
        "/api/v1/tenants/",
        {
            "full_name": "Kader",
            "phone_number": "70112288",
            "email": "kader@example.com",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert tenant.status_code == 201

    monkeypatch.setattr("secrets.randbelow", lambda _: 123456)

    verify = api_client.post(
        f"/api/v1/tenants/{tenant.data['id']}/whatsapp/verify/",
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert verify.status_code == 200

    confirm = api_client.post(
        f"/api/v1/tenants/{tenant.data['id']}/whatsapp/confirm/",
        {"code": "123456"},
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert confirm.status_code == 200


@pytest.mark.django_db
def test_leases_export_csv(api_client, user_password):
    owner = _create_user("0700000610", "owner11@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Export Leases", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    property_a = Property.objects.create(
        agency=agency,
        title="Villa Export",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="100000",
        is_available=True,
    )
    Lease.objects.create(
        agency=agency,
        property=property_a,
        tenant_name="Mariam",
        tenant_phone="70112290",
        tenant_email="mariam@example.com",
        start_date=timezone.localdate(),
        rent_amount="100000",
        deposit_amount="100000",
    )

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = api_client.get(
        "/api/v1/leases/export/?status=active",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert response.status_code == 200
    assert "text/csv" in response["Content-Type"]
    assert "Mariam" in response.content.decode("utf-8")


@pytest.mark.django_db
def test_tenants_export_csv(api_client, user_password):
    owner = _create_user("0700000611", "owner12@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Export Tenants", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    tenant = api_client.post(
        "/api/v1/tenants/",
        {
            "full_name": "Issa",
            "phone_number": "70112291",
            "email": "issa@example.com",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert tenant.status_code == 201

    response = api_client.get(
        "/api/v1/tenants/export/",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert response.status_code == 200
    assert "text/csv" in response["Content-Type"]
    assert "Issa" in response.content.decode("utf-8")
