import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.agencies.models import Agency, AgencyMembership, AgencyRole
from apps.leases.models import Lease, Tenant
from apps.notifications.models import NotificationLog, TenantNotificationPreference
from apps.payments.models import Payment
from apps.properties.models import Property


@pytest.mark.django_db
@override_settings(
    SMS_SIMULATE=True,
    WHATSAPP_SIMULATE=True,
    NOTIFICATION_CHANNELS=["sms"],
    RENT_REMINDER_DAYS=["0"],
)
def test_send_rent_reminders_command(monkeypatch):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    owner = User.objects.create_user(
        phone_number="70000000",
        full_name="Owner",
        email="owner@example.com",
        password="S3cretPass#123",
    )
    agency = Agency.objects.create(name="Agence Notify", created_by=owner)
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
    today = timezone.localdate().replace(day=1)
    lease = Lease.objects.create(
        agency=agency,
        property=property_a,
        tenant_name="Awa",
        tenant_phone="70112233",
        tenant_email="awa@example.com",
        start_date=today.replace(day=1),
        rent_amount="100000",
        deposit_amount="100000",
    )

    def fake_localdate():
        return today

    monkeypatch.setattr(timezone, "localdate", fake_localdate)

    call_command("send_rent_reminders")
    logs = NotificationLog.objects.filter(lease=lease)
    assert logs.count() == 1


@pytest.mark.django_db
@override_settings(
    SMS_SIMULATE=True,
    WHATSAPP_SIMULATE=True,
    NOTIFICATION_CHANNELS=["sms"],
    RENT_REMINDER_DAYS=["0"],
)
def test_preferences_disable_sms(monkeypatch):
    User = get_user_model()
    owner = User.objects.create_user(
        phone_number="70000001",
        full_name="Owner2",
        email="owner2@example.com",
        password="S3cretPass#123",
    )
    agency = Agency.objects.create(name="Agence Pref", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    property_a = Property.objects.create(
        agency=agency,
        title="Villa B",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="100000",
        is_available=True,
    )
    today = timezone.localdate().replace(day=1)
    lease = Lease.objects.create(
        agency=agency,
        property=property_a,
        tenant_name="Binta",
        tenant_phone="70112299",
        tenant_email="binta@example.com",
        start_date=today,
        rent_amount="100000",
        deposit_amount="100000",
    )
    tenant = Tenant.objects.create(
        agency=agency,
        full_name="Binta",
        phone_number="70112299",
        email="binta@example.com",
    )
    lease.tenant = tenant
    lease.save(update_fields=["tenant"])

    TenantNotificationPreference.objects.create(
        tenant=tenant,
        allow_sms=False,
        allow_email=True,
        allow_whatsapp=True,
        remind_days="0",
    )

    def fake_localdate():
        return today

    monkeypatch.setattr(timezone, "localdate", fake_localdate)

    call_command("send_rent_reminders")
    logs = NotificationLog.objects.filter(lease=lease)
    assert logs.count() == 0


@pytest.mark.django_db
def test_notification_logs_api():
    User = get_user_model()
    api_client = APIClient()
    owner = User.objects.create_user(
        phone_number="70000002",
        full_name="Owner3",
        email="owner3@example.com",
        password="S3cretPass#123",
    )
    agency = Agency.objects.create(name="Agence Logs", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    property_a = Property.objects.create(
        agency=agency,
        title="Villa L",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="100000",
        is_available=True,
    )
    tenant = Tenant.objects.create(
        agency=agency,
        full_name="Lina",
        phone_number="70112255",
        email="lina@example.com",
    )
    lease = Lease.objects.create(
        agency=agency,
        property=property_a,
        tenant=tenant,
        tenant_name="Lina",
        tenant_phone="70112255",
        tenant_email="lina@example.com",
        start_date=timezone.localdate(),
        rent_amount="100000",
        deposit_amount="100000",
    )

    log = NotificationLog.objects.create(
        agency=agency,
        lease=lease,
        tenant=tenant,
        channel="sms",
        template_key="rent_due_today",
        scheduled_for=timezone.localdate(),
        status="sent",
        message="Test",
        sent_at=timezone.now(),
    )

    response = api_client.post(
        "/api/v1/auth/jwt/create/",
        {"login": owner.phone_number, "password": "S3cretPass#123"},
        format="json",
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    logs = api_client.get(
        "/api/v1/notifications/logs/",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert logs.status_code == 200
    assert len(logs.data) == 1
    assert logs.data[0]["id"] == str(log.id)


@pytest.mark.django_db
def test_notifications_dashboard_api():
    User = get_user_model()
    api_client = APIClient()
    owner = User.objects.create_user(
        phone_number="70000003",
        full_name="Owner4",
        email="owner4@example.com",
        password="S3cretPass#123",
    )
    agency = Agency.objects.create(name="Agence Dash", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    property_a = Property.objects.create(
        agency=agency,
        title="Villa D",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="100000",
        is_available=True,
    )
    tenant = Tenant.objects.create(
        agency=agency,
        full_name="Dina",
        phone_number="70112266",
        email="dina@example.com",
    )
    lease = Lease.objects.create(
        agency=agency,
        property=property_a,
        tenant=tenant,
        tenant_name="Dina",
        tenant_phone="70112266",
        tenant_email="dina@example.com",
        start_date=timezone.localdate(),
        rent_amount="100000",
        deposit_amount="100000",
    )
    NotificationLog.objects.create(
        agency=agency,
        lease=lease,
        tenant=tenant,
        channel="sms",
        template_key="rent_due_today",
        scheduled_for=timezone.localdate(),
        status="sent",
        message="Test",
        sent_at=timezone.now(),
    )

    response = api_client.post(
        "/api/v1/auth/jwt/create/",
        {"login": owner.phone_number, "password": "S3cretPass#123"},
        format="json",
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    dashboard = api_client.get(
        "/api/v1/notifications/dashboard/",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert dashboard.status_code == 200
    assert dashboard.data["total"] == 1


@pytest.mark.django_db
@override_settings(
    SMS_SIMULATE=True,
    WHATSAPP_SIMULATE=True,
    NOTIFICATION_CHANNELS=["sms"],
)
def test_bulk_reminders_api():
    User = get_user_model()
    api_client = APIClient()
    owner = User.objects.create_user(
        phone_number="70000004",
        full_name="Owner5",
        email="owner5@example.com",
        password="S3cretPass#123",
    )
    agency = Agency.objects.create(name="Agence Bulk", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    property_a = Property.objects.create(
        agency=agency,
        title="Villa Bulk",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="100000",
        is_available=True,
    )
    property_b = Property.objects.create(
        agency=agency,
        title="Villa Paid",
        address="Ouaga",
        city="Ouaga",
        property_type="house",
        rent_amount="100000",
        is_available=True,
    )
    today = timezone.localdate()
    lease_a = Lease.objects.create(
        agency=agency,
        property=property_a,
        tenant_name="Ali",
        tenant_phone="70110001",
        tenant_email="ali@example.com",
        start_date=today,
        rent_amount="100000",
        deposit_amount="100000",
    )
    lease_b = Lease.objects.create(
        agency=agency,
        property=property_b,
        tenant_name="Sara",
        tenant_phone="70110002",
        tenant_email="sara@example.com",
        start_date=today,
        rent_amount="100000",
        deposit_amount="100000",
    )

    Payment.objects.create(
        agency=agency,
        lease=lease_b,
        amount="100000",
        status="paid",
        paid_at=timezone.now(),
    )

    response = api_client.post(
        "/api/v1/auth/jwt/create/",
        {"login": owner.phone_number, "password": "S3cretPass#123"},
        format="json",
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    bulk = api_client.post(
        "/api/v1/notifications/reminders/bulk/",
        {"channels": ["sms"], "due_date": today.isoformat()},
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert bulk.status_code == 200
    assert bulk.data["results"]["sent"] >= 1
