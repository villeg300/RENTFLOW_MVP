from django.contrib.auth import get_user_model
from djoser.serializers import UserCreateSerializer as BaseUserCreateSerializer
from djoser.conf import settings as djoser_settings
from djoser.serializers import UserSerializer as BaseUserSerializer
from rest_framework import serializers
from django.contrib.auth.models import update_last_login
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenObtainSerializer,
)
from rest_framework_simplejwt.settings import api_settings

from apps.agencies.models import AgencyMembership

User = get_user_model()


class UserCreateSerializer(BaseUserCreateSerializer):
    class Meta(BaseUserCreateSerializer.Meta):
        model = User
        fields = ("id", "phone_number", "email", "full_name", "password")


class UserCreatePasswordRetypeSerializer(UserCreateSerializer):
    default_error_messages = {
        "password_mismatch": djoser_settings.CONSTANTS.messages.PASSWORD_MISMATCH_ERROR
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["re_password"] = serializers.CharField(
            style={"input_type": "password"}
        )

    def validate(self, attrs):
        self.fields.pop("re_password", None)
        re_password = attrs.pop("re_password")
        attrs = super().validate(attrs)
        if attrs["password"] == re_password:
            return attrs
        self.fail("password_mismatch")


class UserSerializer(BaseUserSerializer):
    agencies = serializers.SerializerMethodField()

    class Meta(BaseUserSerializer.Meta):
        model = User
        fields = ("id", "phone_number", "email", "full_name", "agencies")

    def get_agencies(self, obj):
        memberships = (
            AgencyMembership.objects.select_related("agency")
            .filter(user=obj, is_active=True)
            .order_by("-joined_at")
        )
        return [
            {
                "agency_id": str(member.agency_id),
                "name": member.agency.name,
                "slug": member.agency.slug,
                "role": member.role,
            }
            for member in memberships
        ]


class PhoneOrEmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "login"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Allow email or phone_number instead of a dedicated login field.
        self.fields["login"].required = False
        self.fields["email"] = serializers.EmailField(required=False)
        self.fields["phone_number"] = serializers.CharField(required=False)
        self.fields["agency_id"] = serializers.UUIDField(required=False)

    def validate(self, attrs):
        login = (
            attrs.get("login")
            or attrs.get("email")
            or attrs.get("phone_number")
            or self.initial_data.get("login")
            or self.initial_data.get("email")
            or self.initial_data.get("phone_number")
        )
        if not login:
            raise serializers.ValidationError(
                {"login": "Renseignez un numéro de téléphone ou un email."}
            )

        attrs["login"] = login

        requested_agency_id = attrs.pop("agency_id", None) or self.initial_data.get(
            "agency_id"
        )

        # Authenticate user first (TokenObtainSerializer only).
        TokenObtainSerializer.validate(self, attrs)

        membership_qs = AgencyMembership.objects.filter(
            user=self.user, is_active=True
        ).select_related("agency")

        membership = None
        if requested_agency_id:
            membership = membership_qs.filter(agency_id=requested_agency_id).first()
            if not membership:
                raise serializers.ValidationError(
                    {"agency_id": "Vous n'êtes pas membre de cette agence."}
                )
        else:
            if membership_qs.count() == 1:
                membership = membership_qs.first()

        refresh = self.get_token(self.user)

        if membership:
            refresh["agency_id"] = str(membership.agency_id)
            refresh["agency_role"] = membership.role
            refresh["agency_slug"] = membership.agency.slug

        access = refresh.access_token
        if membership:
            access["agency_id"] = str(membership.agency_id)
            access["agency_role"] = membership.role
            access["agency_slug"] = membership.agency.slug

        data = {
            "refresh": str(refresh),
            "access": str(access),
        }

        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, self.user)

        return data
