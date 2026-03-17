from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Agency, AgencyInvitation, AgencyMembership, InvitationStatus

User = get_user_model()


class AgencySerializer(serializers.ModelSerializer):
    members_count = serializers.IntegerField(read_only=True)
    role = serializers.SerializerMethodField()

    class Meta:
        model = Agency
        fields = (
            "id",
            "name",
            "slug",
            "email",
            "phone_number",
            "address",
            "is_active",
            "created_at",
            "updated_at",
            "members_count",
            "role",
        )
        read_only_fields = ("id", "slug", "created_at", "updated_at", "members_count")

    def get_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return None
        membership = obj.memberships.filter(
            user=request.user, is_active=True
        ).first()
        return membership.role if membership else None


class AgencyMemberUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "phone_number", "email", "full_name")


class AgencyMemberSerializer(serializers.ModelSerializer):
    user = AgencyMemberUserSerializer(read_only=True)

    class Meta:
        model = AgencyMembership
        fields = ("id", "user", "role", "is_active", "joined_at")
        read_only_fields = ("id", "user", "joined_at")


class AgencyMemberCreateSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = AgencyMembership
        fields = ("id", "user_id", "role", "is_active", "joined_at")
        read_only_fields = ("id", "joined_at")

    def validate_user_id(self, value):
        if not User.objects.filter(id=value).exists():
            raise serializers.ValidationError("Utilisateur introuvable.")
        return value

    def create(self, validated_data):
        user_id = validated_data.pop("user_id")
        user = User.objects.get(id=user_id)
        return AgencyMembership.objects.create(user=user, **validated_data)


class AgencyMemberUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgencyMembership
        fields = ("role", "is_active")


class AgencyInvitationSerializer(serializers.ModelSerializer):
    is_expired = serializers.SerializerMethodField()
    invited_by = AgencyMemberUserSerializer(read_only=True)

    class Meta:
        model = AgencyInvitation
        fields = (
            "id",
            "email",
            "role",
            "status",
            "message",
            "invited_by",
            "created_at",
            "expires_at",
            "accepted_at",
            "is_expired",
        )
        read_only_fields = ("id", "status", "invited_by", "created_at", "accepted_at")

    def get_is_expired(self, obj):
        return obj.is_expired


class AgencyInvitationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgencyInvitation
        fields = ("id", "email", "role", "message", "expires_at")
        read_only_fields = ("id",)

    def validate_email(self, value):
        return value.lower().strip()

    def validate(self, attrs):
        agency = self.context.get("agency")
        if not agency:
            return attrs

        email = attrs.get("email")
        if AgencyMembership.objects.filter(
            agency=agency, user__email__iexact=email, is_active=True
        ).exists():
            raise serializers.ValidationError(
                {"email": "Cet utilisateur est deja membre de cette agence."}
            )

        if AgencyInvitation.objects.filter(
            agency=agency, email__iexact=email, status=InvitationStatus.PENDING
        ).exists():
            raise serializers.ValidationError(
                {"email": "Une invitation en attente existe deja."}
            )

        return attrs


class AgencyInvitationPublicSerializer(serializers.ModelSerializer):
    agency_name = serializers.CharField(source="agency.name", read_only=True)

    class Meta:
        model = AgencyInvitation
        fields = (
            "email",
            "role",
            "status",
            "agency_name",
            "expires_at",
        )


class AcceptInvitationSerializer(serializers.Serializer):
    token = serializers.UUIDField()
    full_name = serializers.CharField(required=False, allow_blank=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
