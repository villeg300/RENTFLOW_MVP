from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AcceptInvitationView,
    AgencyInvitationViewSet,
    AgencyMemberViewSet,
    AgencyViewSet,
    InvitationDetailView,
)

router = DefaultRouter()
router.register("agencies", AgencyViewSet, basename="agency")

agency_members = AgencyMemberViewSet.as_view(
    {"get": "list", "post": "create"}
)
agency_member_detail = AgencyMemberViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
agency_invitations = AgencyInvitationViewSet.as_view(
    {"get": "list", "post": "create"}
)
agency_invitation_detail = AgencyInvitationViewSet.as_view({"delete": "destroy"})
agency_invitation_resend = AgencyInvitationViewSet.as_view({"post": "resend"})
agency_invitation_revoke = AgencyInvitationViewSet.as_view({"post": "revoke"})

urlpatterns = [
    path("", include(router.urls)),
    path("agencies/<uuid:agency_id>/members/", agency_members, name="agency-members"),
    path(
        "agencies/<uuid:agency_id>/members/<uuid:pk>/",
        agency_member_detail,
        name="agency-member-detail",
    ),
    path(
        "agencies/<uuid:agency_id>/invitations/",
        agency_invitations,
        name="agency-invitations",
    ),
    path(
        "agencies/<uuid:agency_id>/invitations/<uuid:pk>/",
        agency_invitation_detail,
        name="agency-invitation-detail",
    ),
    path(
        "agencies/<uuid:agency_id>/invitations/<uuid:pk>/resend/",
        agency_invitation_resend,
        name="agency-invitation-resend",
    ),
    path(
        "agencies/<uuid:agency_id>/invitations/<uuid:pk>/revoke/",
        agency_invitation_revoke,
        name="agency-invitation-revoke",
    ),
    path(
        "agencies/invitations/accept/",
        AcceptInvitationView.as_view(),
        name="agency-invitation-accept",
    ),
    path(
        "agencies/invitations/<uuid:token>/",
        InvitationDetailView.as_view(),
        name="agency-invitation-detail-public",
    ),
]
