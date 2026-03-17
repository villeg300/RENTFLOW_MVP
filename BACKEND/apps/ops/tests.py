import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from django_celery_beat.models import CrontabSchedule, PeriodicTask

from apps.agencies.models import Agency, AgencyMembership, AgencyRole
from .models import TaskRun

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


def _login(api_client, login, password):
    response = api_client.post(
        "/api/v1/auth/jwt/create/", {"login": login, "password": password}, format="json"
    )
    assert response.status_code == 200
    return response.data["access"]


@pytest.mark.django_db
def test_ops_task_status_endpoint(api_client, user_password):
    owner = _create_user("0700000910", "owner-ops@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Ops", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    schedule, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="8", day_of_week="*", day_of_month="*", month_of_year="*", timezone="UTC"
    )
    PeriodicTask.objects.create(
        name="send_rent_reminders_daily",
        task="apps.notifications.tasks.send_rent_reminders_task",
        crontab=schedule,
    )

    TaskRun.objects.create(
        task_name="apps.notifications.tasks.send_rent_reminders_task",
        last_started_at=timezone.now(),
        last_finished_at=timezone.now(),
        last_status="success",
        run_count=1,
    )

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = api_client.get("/api/v1/ops/tasks/?page=1&page_size=20")
    assert response.status_code == 200
    assert response.data["count"] >= 1
    assert len(response.data["results"]) >= 1
