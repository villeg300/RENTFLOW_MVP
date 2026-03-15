from django.contrib.auth import get_user_model
from djoser.serializers import UserCreateSerializer as BaseUserCreateSerializer
from djoser.conf import settings as djoser_settings
from djoser.serializers import UserSerializer as BaseUserSerializer
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

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
    class Meta(BaseUserSerializer.Meta):
        model = User
        fields = ("id", "phone_number", "email", "full_name")


class PhoneOrEmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "login"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Allow email or phone_number instead of a dedicated login field.
        self.fields["login"].required = False
        self.fields["email"] = serializers.EmailField(required=False)
        self.fields["phone_number"] = serializers.CharField(required=False)

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
        return super().validate(attrs)
