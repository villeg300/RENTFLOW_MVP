import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from djoser import utils
from rest_framework.test import APIClient

from apps.accounts.models import AuditAction, AuditLog

User = get_user_model()


@pytest.fixture()
def api_client():
    return APIClient()


@pytest.fixture()
def user_password():
    return "S3cretPass#123"


@pytest.fixture()
def user(user_password):
    return User.objects.create_user(
        phone_number="0700000000",
        full_name="Awa Traore",
        email="awa@example.com",
        password=user_password,
    )


@pytest.mark.django_db
def test_create_user_requires_phone_number(user_password):
    with pytest.raises(ValueError):
        User.objects.create_user(
            phone_number="",
            full_name="Test User",
            password=user_password,
        )


@pytest.mark.django_db
def test_create_user_requires_full_name(user_password):
    with pytest.raises(ValueError):
        User.objects.create_user(
            phone_number="0700000001",
            full_name="",
            password=user_password,
        )


@pytest.mark.django_db
def test_register_user(api_client):
    payload = {
        "phone_number": "0700000002",
        "full_name": "Kadi Diallo",
        "email": "kadi@example.com",
        "password": "S3cretPass#123",
        "re_password": "S3cretPass#123",
    }
    response = api_client.post("/api/v1/auth/users/", payload, format="json")
    assert response.status_code == 201
    assert response.data["phone_number"] == payload["phone_number"]
    assert response.data["full_name"] == payload["full_name"]
    assert response.data["email"] == payload["email"]

    created_user = User.objects.get(phone_number=payload["phone_number"])
    assert created_user.is_active is False


@pytest.mark.django_db
def test_register_user_requires_email(api_client):
    payload = {
        "phone_number": "0700000011",
        "full_name": "Missing Email",
        "password": "S3cretPass#123",
        "re_password": "S3cretPass#123",
    }
    response = api_client.post("/api/v1/auth/users/", payload, format="json")
    assert response.status_code == 400
    assert "email" in response.data


@pytest.mark.django_db
def test_activation_flow(api_client):
    payload = {
        "phone_number": "0700000003",
        "full_name": "Nina Traore",
        "email": "nina@example.com",
        "password": "S3cretPass#123",
        "re_password": "S3cretPass#123",
    }
    response = api_client.post("/api/v1/auth/users/", payload, format="json")
    assert response.status_code == 201

    user = User.objects.get(phone_number=payload["phone_number"])
    assert user.is_active is False

    login_response = api_client.post(
        "/api/v1/auth/jwt/create/",
        {"login": user.email, "password": payload["password"]},
        format="json",
    )
    assert login_response.status_code == 401

    uid = utils.encode_uid(user.pk)
    token = default_token_generator.make_token(user)
    activation_response = api_client.post(
        "/api/v1/auth/users/activation/",
        {"uid": uid, "token": token},
        format="json",
    )
    assert activation_response.status_code == 204

    user.refresh_from_db()
    assert user.is_active is True

    login_response = api_client.post(
        "/api/v1/auth/jwt/create/",
        {"login": user.email, "password": payload["password"]},
        format="json",
    )
    assert login_response.status_code == 200


@pytest.mark.django_db
def test_login_with_phone_number(api_client, user, user_password):
    payload = {"login": user.phone_number, "password": user_password}
    response = api_client.post("/api/v1/auth/jwt/create/", payload, format="json")
    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data
    assert AuditLog.objects.filter(
        action=AuditAction.LOGIN_SUCCESS, user=user
    ).exists()


@pytest.mark.django_db
def test_login_with_email(api_client, user, user_password):
    payload = {"login": user.email, "password": user_password}
    response = api_client.post("/api/v1/auth/jwt/create/", payload, format="json")
    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data


@pytest.mark.django_db
def test_refresh_and_verify_and_logout(api_client, user, user_password):
    login_payload = {"login": user.phone_number, "password": user_password}
    login_response = api_client.post(
        "/api/v1/auth/jwt/create/", login_payload, format="json"
    )
    assert login_response.status_code == 200

    access = login_response.data["access"]
    refresh = login_response.data["refresh"]

    refresh_response = api_client.post(
        "/api/v1/auth/jwt/refresh/", {"refresh": refresh}, format="json"
    )
    assert refresh_response.status_code == 200
    assert "access" in refresh_response.data
    refresh = refresh_response.data.get("refresh", refresh)

    verify_response = api_client.post(
        "/api/v1/auth/jwt/verify/", {"token": access}, format="json"
    )
    assert verify_response.status_code == 200

    logout_response = api_client.post(
        "/api/v1/auth/jwt/logout/", {"refresh": refresh}, format="json"
    )
    assert 200 <= logout_response.status_code < 300


@pytest.mark.django_db
def test_logout_all_invalidates_refresh(api_client, user, user_password):
    login_payload = {"login": user.phone_number, "password": user_password}
    login_response = api_client.post(
        "/api/v1/auth/jwt/create/", login_payload, format="json"
    )
    assert login_response.status_code == 200

    access = login_response.data["access"]
    refresh = login_response.data["refresh"]

    logout_all_response = api_client.post(
        "/api/v1/auth/jwt/logout_all/",
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {access}",
    )
    assert logout_all_response.status_code == 204

    refresh_response = api_client.post(
        "/api/v1/auth/jwt/refresh/", {"refresh": refresh}, format="json"
    )
    assert refresh_response.status_code == 401


@pytest.mark.django_db
def test_change_password(api_client, user, user_password):
    login_payload = {"login": user.phone_number, "password": user_password}
    login_response = api_client.post(
        "/api/v1/auth/jwt/create/", login_payload, format="json"
    )
    assert login_response.status_code == 200

    access = login_response.data["access"]
    new_password = "NewS3cretPass#456"

    change_response = api_client.post(
        "/api/v1/auth/users/set_password/",
        {"current_password": user_password, "new_password": new_password},
        format="json",
        HTTP_AUTHORIZATION=f"Bearer {access}",
    )
    assert change_response.status_code == 204

    old_login = api_client.post(
        "/api/v1/auth/jwt/create/",
        {"login": user.phone_number, "password": user_password},
        format="json",
    )
    assert old_login.status_code == 401

    new_login = api_client.post(
        "/api/v1/auth/jwt/create/",
        {"login": user.phone_number, "password": new_password},
        format="json",
    )
    assert new_login.status_code == 200


@pytest.mark.django_db
def test_forgot_password_flow(api_client, user):
    response = api_client.post(
        "/api/v1/auth/users/reset_password/",
        {"email": user.email},
        format="json",
    )
    assert response.status_code == 204
    assert len(mail.outbox) == 1
    assert AuditLog.objects.filter(
        action=AuditAction.PASSWORD_RESET_REQUESTED
    ).exists()

    uid = utils.encode_uid(user.pk)
    token = default_token_generator.make_token(user)
    new_password = "ResetS3cret#789"

    confirm_response = api_client.post(
        "/api/v1/auth/users/reset_password_confirm/",
        {
            "uid": uid,
            "token": token,
            "new_password": new_password,
            "re_new_password": new_password,
        },
        format="json",
    )
    assert confirm_response.status_code == 204

    login_response = api_client.post(
        "/api/v1/auth/jwt/create/",
        {"login": user.email, "password": new_password},
        format="json",
    )
    assert login_response.status_code == 200
