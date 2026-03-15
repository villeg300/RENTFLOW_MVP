from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


class PhoneOrEmailBackend(ModelBackend):
    def authenticate(
        self,
        request,
        login=None,
        username=None,
        phone_number=None,
        email=None,
        password=None,
        **kwargs,
    ):
        if password is None:
            return None

        user_model = get_user_model()
        identifier = (
            login
            or phone_number
            or email
            or username
            or kwargs.get(user_model.USERNAME_FIELD)
        )
        if not identifier:
            return None

        user = None
        if isinstance(identifier, str) and "@" in identifier:
            user = user_model.objects.filter(email__iexact=identifier).first()
        if user is None:
            user = user_model.objects.filter(phone_number=identifier).first()
        if user is None:
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
