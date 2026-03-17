import pytest
from datetime import timedelta
from django.core.management import call_command
from django.core import mail
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Agency, AgencyMembership, AgencyRole
from .models import AgencyInvitation, InvitationStatus

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
def test_create_agency_creates_owner_membership(api_client, user_password):
    user = _create_user("0700000001", "owner@example.com", user_password, "Owner")
    access = _login(api_client, user.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    payload = {
        "name": "Agence Alpha",
        "email": "contact@alpha.com",
        "phone_number": "70000000",
        "address": "Ouagadougou",
    }
    response = api_client.post("/api/v1/agencies/", payload, format="json")
    assert response.status_code == 201

    membership = AgencyMembership.objects.get(
        agency_id=response.data["id"], user=user
    )
    assert membership.role == AgencyRole.OWNER
    assert response.data["role"] == AgencyRole.OWNER


@pytest.mark.django_db
def test_owner_can_add_member_and_agent_cannot(api_client, user_password):
    owner = _create_user("0700000010", "owner2@example.com", user_password, "Owner")
    agent = _create_user("0700000011", "agent@example.com", user_password, "Agent")
    target = _create_user("0700000012", "target@example.com", user_password, "Target")
    outsider = _create_user("0700000013", "outsider@example.com", user_password, "Out")

    agency = Agency.objects.create(name="Agence Test", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)
    AgencyMembership.objects.create(agency=agency, user=agent, role=AgencyRole.AGENT)

    owner_access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {owner_access}")

    add_response = api_client.post(
        f"/api/v1/agencies/{agency.id}/members/",
        {"user_id": str(target.id), "role": AgencyRole.MANAGER},
        format="json",
    )
    assert add_response.status_code == 201

    duplicate_response = api_client.post(
        f"/api/v1/agencies/{agency.id}/members/",
        {"user_id": str(target.id), "role": AgencyRole.MANAGER},
        format="json",
    )
    assert duplicate_response.status_code == 400

    agent_access = _login(api_client, agent.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {agent_access}")

    forbidden_response = api_client.post(
        f"/api/v1/agencies/{agency.id}/members/",
        {"user_id": str(outsider.id), "role": AgencyRole.VIEWER},
        format="json",
    )
    assert forbidden_response.status_code == 403


@pytest.mark.django_db
def test_invitation_flow_accepts_member(api_client, user_password):
    owner = _create_user("0700000020", "owner3@example.com", user_password, "Owner")
    invited = _create_user("0700000021", "invited@example.com", user_password, "Invited")
    agency = Agency.objects.create(name="Agence Invite", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    invite_response = api_client.post(
        f"/api/v1/agencies/{agency.id}/invitations/",
        {"email": invited.email, "role": AgencyRole.MANAGER},
        format="json",
    )
    assert invite_response.status_code == 201
    assert len(mail.outbox) == 1

    invitation = AgencyInvitation.objects.get(
        agency=agency, email=invited.email, status=InvitationStatus.PENDING
    )

    invited_access = _login(api_client, invited.email, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {invited_access}")

    accept_response = api_client.post(
        "/api/v1/agencies/invitations/accept/",
        {"token": str(invitation.token)},
        format="json",
    )
    assert accept_response.status_code == 200

    membership = AgencyMembership.objects.get(agency=agency, user=invited)
    assert membership.role == AgencyRole.MANAGER
    invitation.refresh_from_db()
    assert invitation.status == InvitationStatus.ACCEPTED


@pytest.mark.django_db
def test_invitation_auto_signup_for_new_email(api_client, user_password):
    owner = _create_user("0700000030", "owner4@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Auto", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    owner_access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {owner_access}")

    invite_response = api_client.post(
        f"/api/v1/agencies/{agency.id}/invitations/",
        {"email": "new.member@example.com", "role": AgencyRole.AGENT},
        format="json",
    )
    assert invite_response.status_code == 201
    assert len(mail.outbox) == 1

    invitation = AgencyInvitation.objects.get(
        agency=agency, email="new.member@example.com", status=InvitationStatus.PENDING
    )

    api_client.credentials()  # no auth
    accept_response = api_client.post(
        "/api/v1/agencies/invitations/accept/",
        {
            "token": str(invitation.token),
            "full_name": "New Member",
            "phone_number": "0700000099",
        },
        format="json",
    )
    assert accept_response.status_code == 200
    assert len(mail.outbox) == 2  # invitation + password reset

    membership = AgencyMembership.objects.get(
        agency=agency, user__email="new.member@example.com"
    )
    assert membership.role == AgencyRole.AGENT
    invitation.refresh_from_db()
    assert invitation.status == InvitationStatus.ACCEPTED


@pytest.mark.django_db
def test_invitation_resend_rotates_token(api_client, user_password):
    owner = _create_user("0700000040", "owner5@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Relance", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    invite_response = api_client.post(
        f"/api/v1/agencies/{agency.id}/invitations/",
        {"email": "relance@example.com", "role": AgencyRole.AGENT},
        format="json",
    )
    assert invite_response.status_code == 201
    invitation = AgencyInvitation.objects.get(
        agency=agency, email="relance@example.com", status=InvitationStatus.PENDING
    )
    old_token = invitation.token

    resend_response = api_client.post(
        f"/api/v1/agencies/{agency.id}/invitations/{invitation.id}/resend/",
        format="json",
    )
    assert resend_response.status_code == 200
    invitation.refresh_from_db()
    assert invitation.token != old_token


@pytest.mark.django_db
def test_invitation_revoke(api_client, user_password):
    owner = _create_user("0700000050", "owner6@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Revoke", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    invite_response = api_client.post(
        f"/api/v1/agencies/{agency.id}/invitations/",
        {"email": "revoke@example.com", "role": AgencyRole.AGENT},
        format="json",
    )
    assert invite_response.status_code == 201
    invitation = AgencyInvitation.objects.get(
        agency=agency, email="revoke@example.com", status=InvitationStatus.PENDING
    )

    revoke_response = api_client.post(
        f"/api/v1/agencies/{agency.id}/invitations/{invitation.id}/revoke/",
        format="json",
    )
    assert revoke_response.status_code == 200
    invitation.refresh_from_db()
    assert invitation.status == InvitationStatus.REVOKED


@pytest.mark.django_db
def test_invitation_rejects_duplicate_pending(api_client, user_password):
    owner = _create_user("0700000070", "owner8@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Duplicate", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    first = api_client.post(
        f"/api/v1/agencies/{agency.id}/invitations/",
        {"email": "dup@example.com", "role": AgencyRole.AGENT},
        format="json",
    )
    assert first.status_code == 201

    second = api_client.post(
        f"/api/v1/agencies/{agency.id}/invitations/",
        {"email": "dup@example.com", "role": AgencyRole.AGENT},
        format="json",
    )
    assert second.status_code == 400


@pytest.mark.django_db
def test_invitation_rejects_existing_member(api_client, user_password):
    owner = _create_user("0700000080", "owner9@example.com", user_password, "Owner")
    member = _create_user("0700000081", "member@example.com", user_password, "Member")
    agency = Agency.objects.create(name="Agence Member", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)
    AgencyMembership.objects.create(agency=agency, user=member, role=AgencyRole.AGENT)

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = api_client.post(
        f"/api/v1/agencies/{agency.id}/invitations/",
        {"email": member.email, "role": AgencyRole.AGENT},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_invitation_accept_wrong_email_forbidden(api_client, user_password):
    owner = _create_user("0700000090", "owner10@example.com", user_password, "Owner")
    invited = _create_user("0700000091", "invited2@example.com", user_password, "Invited")
    other = _create_user("0700000092", "other@example.com", user_password, "Other")
    agency = Agency.objects.create(name="Agence Wrong", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    invite_response = api_client.post(
        f"/api/v1/agencies/{agency.id}/invitations/",
        {"email": invited.email, "role": AgencyRole.AGENT},
        format="json",
    )
    assert invite_response.status_code == 201
    invitation = AgencyInvitation.objects.get(
        agency=agency, email=invited.email, status=InvitationStatus.PENDING
    )

    other_access = _login(api_client, other.email, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {other_access}")

    accept_response = api_client.post(
        "/api/v1/agencies/invitations/accept/",
        {"token": str(invitation.token)},
        format="json",
    )
    assert accept_response.status_code == 403


@pytest.mark.django_db
def test_invitation_accept_expired(api_client, user_password):
    owner = _create_user("0700000101", "owner11@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Expire2", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    invitation = AgencyInvitation.objects.create(
        agency=agency,
        email="expired@example.com",
        role=AgencyRole.AGENT,
        invited_by=owner,
        status=InvitationStatus.PENDING,
        expires_at=timezone.now() - timedelta(days=1),
    )

    response = api_client.post(
        "/api/v1/agencies/invitations/accept/",
        {"token": str(invitation.token)},
        format="json",
    )
    assert response.status_code == 400
    invitation.refresh_from_db()
    assert invitation.status == InvitationStatus.EXPIRED


@pytest.mark.django_db
def test_invitation_public_marks_expired(api_client, user_password):
    owner = _create_user("0700000102", "owner12@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Public", created_by=owner)
    invitation = AgencyInvitation.objects.create(
        agency=agency,
        email="public@example.com",
        role=AgencyRole.AGENT,
        invited_by=owner,
        status=InvitationStatus.PENDING,
        expires_at=timezone.now() - timedelta(days=1),
    )

    response = api_client.get(f"/api/v1/agencies/invitations/{invitation.token}/")
    assert response.status_code == 200
    invitation.refresh_from_db()
    assert invitation.status == InvitationStatus.EXPIRED


@pytest.mark.django_db
def test_invitation_existing_active_user_requires_login(api_client, user_password):
    owner = _create_user("0700000103", "owner13@example.com", user_password, "Owner")
    existing = _create_user("0700000104", "existing@example.com", user_password, "Existing")
    agency = Agency.objects.create(name="Agence Existing", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    invitation = AgencyInvitation.objects.create(
        agency=agency,
        email=existing.email,
        role=AgencyRole.AGENT,
        invited_by=owner,
        status=InvitationStatus.PENDING,
    )

    response = api_client.post(
        "/api/v1/agencies/invitations/accept/",
        {"token": str(invitation.token)},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_invitation_existing_inactive_user_auto_activates(api_client, user_password):
    owner = _create_user("0700000105", "owner14@example.com", user_password, "Owner")
    existing = _create_user("0700000106", "inactive@example.com", user_password, "Inactive")
    existing.is_active = False
    existing.save(update_fields=["is_active"])

    agency = Agency.objects.create(name="Agence Inactive", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    invitation = AgencyInvitation.objects.create(
        agency=agency,
        email=existing.email,
        role=AgencyRole.AGENT,
        invited_by=owner,
        status=InvitationStatus.PENDING,
    )

    response = api_client.post(
        "/api/v1/agencies/invitations/accept/",
        {"token": str(invitation.token)},
        format="json",
    )
    assert response.status_code == 200
    existing.refresh_from_db()
    assert existing.is_active is True
    assert AgencyMembership.objects.filter(agency=agency, user=existing).exists()


@pytest.mark.django_db
def test_manager_cannot_update_agency(api_client, user_password):
    owner = _create_user("0700000107", "owner15@example.com", user_password, "Owner")
    manager = _create_user("0700000108", "manager@example.com", user_password, "Manager")
    agency = Agency.objects.create(name="Agence Manager", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)
    AgencyMembership.objects.create(agency=agency, user=manager, role=AgencyRole.MANAGER)

    manager_access = _login(api_client, manager.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {manager_access}")

    response = api_client.patch(
        f"/api/v1/agencies/{agency.id}/",
        {"name": "New Name"},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_expire_invitations_command():
    owner = _create_user("0700000060", "owner7@example.com", "Pass#12345", "Owner")
    agency = Agency.objects.create(name="Agence Expire", created_by=owner)
    invitation = AgencyInvitation.objects.create(
        agency=agency,
        email="expire@example.com",
        role=AgencyRole.AGENT,
        invited_by=owner,
        status=InvitationStatus.PENDING,
        expires_at=timezone.now() - timedelta(days=1),
    )

    call_command("expire_invitations")
    invitation.refresh_from_db()
    assert invitation.status == InvitationStatus.EXPIRED
