import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils.crypto import get_random_string
from django.db.models import Count
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from djoser.compat import get_user_email
from djoser.conf import settings as djoser_settings
from rest_framework import exceptions, mixins, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .emails import send_invitation_email
from .models import (
    Agency,
    AgencyInvitation,
    AgencyMembership,
    AgencyRole,
    InvitationStatus,
)
from .permissions import IsAgencyOwner, IsAgencyOwnerOrManager
from .serializers import (
    AcceptInvitationSerializer,
    AgencyInvitationCreateSerializer,
    AgencyInvitationPublicSerializer,
    AgencyInvitationSerializer,
    AgencyMemberCreateSerializer,
    AgencyMemberSerializer,
    AgencyMemberUpdateSerializer,
    AgencySerializer,
)

User = get_user_model()


class AgencyViewSet(viewsets.ModelViewSet):
    serializer_class = AgencySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Agency.objects.filter(
                memberships__user=self.request.user, memberships__is_active=True
            )
            .annotate(members_count=Count("memberships", distinct=True))
            .distinct()
        )

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAgencyOwner()]
        return super().get_permissions()

    def perform_create(self, serializer):
        agency = serializer.save(created_by=self.request.user)
        AgencyMembership.objects.create(
            agency=agency, user=self.request.user, role=AgencyRole.OWNER
        )


class AgencyMemberViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsAgencyOwnerOrManager]

    def get_agency(self):
        return get_object_or_404(Agency, id=self.kwargs.get("agency_id"))

    def get_queryset(self):
        return AgencyMembership.objects.filter(agency=self.get_agency())

    def get_serializer_class(self):
        if self.action == "create":
            return AgencyMemberCreateSerializer
        if self.action in ("update", "partial_update"):
            return AgencyMemberUpdateSerializer
        return AgencyMemberSerializer

    def perform_create(self, serializer):
        agency = self.get_agency()
        user_id = serializer.validated_data.get("user_id")
        if user_id and AgencyMembership.objects.filter(
            agency=agency, user_id=user_id
        ).exists():
            raise exceptions.ValidationError(
                {"user_id": "Cet utilisateur est deja membre de cette agence."}
            )
        serializer.save(agency=agency)


class AgencyInvitationViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsAgencyOwnerOrManager]

    def get_agency(self):
        return get_object_or_404(Agency, id=self.kwargs.get("agency_id"))

    def get_queryset(self):
        return AgencyInvitation.objects.filter(agency=self.get_agency())

    def get_serializer_class(self):
        if self.action == "create":
            return AgencyInvitationCreateSerializer
        return AgencyInvitationSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["agency"] = self.get_agency()
        return context

    def perform_create(self, serializer):
        invitation = serializer.save(
            agency=self.get_agency(), invited_by=self.request.user
        )
        send_invitation_email(invitation)

    def destroy(self, request, *args, **kwargs):
        invitation = self.get_object()
        invitation.status = InvitationStatus.REVOKED
        invitation.save(update_fields=["status"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def resend(self, request, *args, **kwargs):
        invitation = self.get_object()
        if invitation.status == InvitationStatus.ACCEPTED:
            return Response(
                {"detail": "Invitation deja acceptee."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invitation.status = InvitationStatus.PENDING
        invitation.token = uuid.uuid4()
        invitation.expires_at = timezone.now() + timedelta(days=7)
        invitation.save(update_fields=["status", "token", "expires_at"])
        send_invitation_email(invitation)
        serializer = AgencyInvitationSerializer(invitation)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def revoke(self, request, *args, **kwargs):
        invitation = self.get_object()
        if invitation.status == InvitationStatus.ACCEPTED:
            return Response(
                {"detail": "Impossible de revoquer une invitation acceptee."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invitation.status = InvitationStatus.REVOKED
        invitation.save(update_fields=["status"])
        serializer = AgencyInvitationSerializer(invitation)
        return Response(serializer.data, status=status.HTTP_200_OK)


class InvitationDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token, *args, **kwargs):
        invitation = get_object_or_404(AgencyInvitation, token=token)
        if invitation.is_expired and invitation.status == InvitationStatus.PENDING:
            invitation.status = InvitationStatus.EXPIRED
            invitation.save(update_fields=["status"])
        serializer = AgencyInvitationPublicSerializer(invitation)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AcceptInvitationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]
        full_name = serializer.validated_data.get("full_name", "").strip()
        phone_number = serializer.validated_data.get("phone_number", "").strip()

        invitation = get_object_or_404(AgencyInvitation, token=token)
        if invitation.is_expired:
            invitation.status = InvitationStatus.EXPIRED
            invitation.save(update_fields=["status"])
            return Response(
                {"detail": "Invitation expiree."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if invitation.status != InvitationStatus.PENDING:
            return Response(
                {"detail": "Invitation deja traitee."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user if request.user.is_authenticated else None
        if user:
            if user.email.lower() != invitation.email.lower():
                return Response(
                    {"detail": "Cette invitation ne correspond pas a votre email."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            user = User.objects.filter(email__iexact=invitation.email).first()
            if user and user.is_active:
                return Response(
                    {"detail": "Connectez-vous pour accepter cette invitation."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if user and not user.is_active:
                user.is_active = True
                user.save(update_fields=["is_active"])
            if not user:
                if not full_name or not phone_number:
                    return Response(
                        {
                            "detail": "Nom complet et numero de telephone requis pour creer un compte.",
                            "fields": ["full_name", "phone_number"],
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if User.objects.filter(phone_number=phone_number).exists():
                    return Response(
                        {"detail": "Ce numero de telephone est deja utilise."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                random_password = get_random_string(32)
                user = User.objects.create_user(
                    phone_number=phone_number,
                    full_name=full_name,
                    email=invitation.email,
                    password=random_password,
                    is_active=True,
                )
                email_context = {"user": user}
                to = [get_user_email(user)]
                djoser_settings.EMAIL.password_reset(request, email_context).send(to)

        membership, _ = AgencyMembership.objects.get_or_create(
            agency=invitation.agency,
            user=user,
            defaults={"role": invitation.role, "is_active": True},
        )
        if membership.role != invitation.role:
            membership.role = invitation.role
            membership.save(update_fields=["role"])

        invitation.status = InvitationStatus.ACCEPTED
        invitation.accepted_by = user
        invitation.accepted_at = timezone.now()
        invitation.save(update_fields=["status", "accepted_by", "accepted_at"])

        return Response(
            {"detail": "Invitation acceptee.", "agency_id": str(invitation.agency_id)},
            status=status.HTTP_200_OK,
        )


def accept_invitation_view(request):
    token = request.GET.get("token") or request.POST.get("token")
    invitation = None
    errors = []
    success = False
    existing_user = False

    if token:
        invitation = AgencyInvitation.objects.filter(token=token).first()

    if not invitation:
        return render(
            request,
            "accept_invitation.html",
            {"errors": ["Invitation introuvable."], "success": False},
        )

    if invitation.is_expired and invitation.status == InvitationStatus.PENDING:
        invitation.status = InvitationStatus.EXPIRED
        invitation.save(update_fields=["status"])

    if request.method == "POST":
        if invitation.status != InvitationStatus.PENDING:
            errors.append("Invitation deja traitee ou expiree.")
        else:
            user = request.user if request.user.is_authenticated else None
            if user:
                if user.email.lower() != invitation.email.lower():
                    errors.append("Cette invitation ne correspond pas a votre email.")
            else:
                user = User.objects.filter(email__iexact=invitation.email).first()
                if user and user.is_active:
                    existing_user = True
                    errors.append("Connectez-vous pour accepter cette invitation.")
                elif user and not user.is_active:
                    user.is_active = True
                    user.save(update_fields=["is_active"])
                else:
                    full_name = request.POST.get("full_name", "").strip()
                    phone_number = request.POST.get("phone_number", "").strip()
                    if not full_name or not phone_number:
                        errors.append("Nom complet et numero de telephone requis.")
                    elif User.objects.filter(phone_number=phone_number).exists():
                        errors.append("Ce numero de telephone est deja utilise.")
                    else:
                        random_password = get_random_string(32)
                        user = User.objects.create_user(
                            phone_number=phone_number,
                            full_name=full_name,
                            email=invitation.email,
                            password=random_password,
                            is_active=True,
                        )
                        email_context = {"user": user}
                        to = [get_user_email(user)]
                        djoser_settings.EMAIL.password_reset(
                            request, email_context
                        ).send(to)

            if not errors and user:
                membership, _ = AgencyMembership.objects.get_or_create(
                    agency=invitation.agency,
                    user=user,
                    defaults={"role": invitation.role, "is_active": True},
                )
                if membership.role != invitation.role:
                    membership.role = invitation.role
                    membership.save(update_fields=["role"])

                invitation.status = InvitationStatus.ACCEPTED
                invitation.accepted_by = user
                invitation.accepted_at = timezone.now()
                invitation.save(update_fields=["status", "accepted_by", "accepted_at"])
                success = True

    context = {
        "invitation": invitation,
        "token": invitation.token,
        "errors": errors,
        "success": success,
        "existing_user": existing_user,
        "require_details": not request.user.is_authenticated
        and not User.objects.filter(email__iexact=invitation.email).exists(),
    }
    return render(request, "accept_invitation.html", context)
