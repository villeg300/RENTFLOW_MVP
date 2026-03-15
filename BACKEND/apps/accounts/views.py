from django.contrib.auth.tokens import default_token_generator
from django.shortcuts import render
from django.utils.timezone import now
from djoser.compat import get_user_email
from djoser.conf import settings as djoser_settings
from djoser.serializers import (
    ActivationSerializer,
    PasswordResetConfirmRetypeSerializer,
    PasswordResetConfirmSerializer,
    SendEmailResetSerializer,
)
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenBlacklistView, TokenObtainPairView
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)

from .audit import log_event
from .models import AuditAction
from .serializers import PhoneOrEmailTokenObtainPairSerializer


class _ResetViewContext:
    token_generator = default_token_generator


def reset_password_view(request):
    context = {
        "uid": request.GET.get("uid", ""),
        "token": request.GET.get("token", ""),
        "success": False,
        "errors": None,
    }

    if request.method == "POST":
        uid = request.POST.get("uid", "")
        token = request.POST.get("token", "")
        new_password = request.POST.get("new_password", "")
        re_new_password = request.POST.get("re_new_password", "")

        data = {"uid": uid, "token": token, "new_password": new_password}
        serializer_cls = PasswordResetConfirmSerializer
        if djoser_settings.PASSWORD_RESET_CONFIRM_RETYPE:
            data["re_new_password"] = re_new_password
            serializer_cls = PasswordResetConfirmRetypeSerializer

        serializer = serializer_cls(
            data=data, context={"request": request, "view": _ResetViewContext()}
        )
        if serializer.is_valid():
            serializer.user.set_password(serializer.validated_data["new_password"])
            if hasattr(serializer.user, "last_login"):
                serializer.user.last_login = now()
            serializer.user.save()

            if djoser_settings.PASSWORD_CHANGED_EMAIL_CONFIRMATION:
                email_context = {"user": serializer.user}
                to = [get_user_email(serializer.user)]
                djoser_settings.EMAIL.password_changed_confirmation(
                    request, email_context
                ).send(to)

            context["success"] = True
        else:
            context["errors"] = serializer.errors

        context["uid"] = uid
        context["token"] = token

    return render(request, "reset_password.html", context)


class _ActivationViewContext:
    token_generator = default_token_generator


def activate_account_view(request):
    context = {
        "uid": request.GET.get("uid", ""),
        "token": request.GET.get("token", ""),
        "success": False,
        "errors": None,
    }

    if request.method == "POST":
        uid = request.POST.get("uid", "")
        token = request.POST.get("token", "")
        serializer = ActivationSerializer(
            data={"uid": uid, "token": token},
            context={"request": request, "view": _ActivationViewContext()},
        )
        if serializer.is_valid():
            serializer.user.is_active = True
            serializer.user.save()

            if djoser_settings.SEND_CONFIRMATION_EMAIL:
                email_context = {"user": serializer.user}
                to = [get_user_email(serializer.user)]
                djoser_settings.EMAIL.confirmation(request, email_context).send(to)

            log_event(request, AuditAction.USER_ACTIVATED, user=serializer.user)
            context["success"] = True
        else:
            context["errors"] = serializer.errors

        context["uid"] = uid
        context["token"] = token

    return render(request, "activate_account.html", context)


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = PhoneOrEmailTokenObtainPairSerializer
    permission_classes = [AllowAny]
    throttle_scope = "login"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            identifier = (
                request.data.get("login")
                or request.data.get("email")
                or request.data.get("phone_number")
                or request.data.get("username")
            )
            log_event(
                request,
                AuditAction.LOGIN_FAILED,
                metadata={"login": identifier},
            )
            raise

        log_event(request, AuditAction.LOGIN_SUCCESS, user=serializer.user)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class CustomLogoutView(TokenBlacklistView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        user = request.user if request.user.is_authenticated else None
        log_event(request, AuditAction.LOGOUT, user=user)
        return response


class LogoutAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        tokens = OutstandingToken.objects.filter(user=request.user)
        for token in tokens:
            BlacklistedToken.objects.get_or_create(token=token)
        log_event(request, AuditAction.LOGOUT_ALL, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "password_reset"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request, *args, **kwargs):
        serializer = SendEmailResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.get_user()

        if user:
            email_context = {"user": user}
            to = [get_user_email(user)]
            djoser_settings.EMAIL.password_reset(request, email_context).send(to)

        log_event(
            request,
            AuditAction.PASSWORD_RESET_REQUESTED,
            user=user,
            metadata={"email": request.data.get("email")},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResetPasswordConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "password_reset"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request, *args, **kwargs):
        serializer_cls = PasswordResetConfirmSerializer
        if djoser_settings.PASSWORD_RESET_CONFIRM_RETYPE:
            serializer_cls = PasswordResetConfirmRetypeSerializer

        serializer = serializer_cls(
            data=request.data, context={"request": request, "view": _ResetViewContext()}
        )
        serializer.is_valid(raise_exception=True)

        serializer.user.set_password(serializer.validated_data["new_password"])
        if hasattr(serializer.user, "last_login"):
            serializer.user.last_login = now()
        serializer.user.save()

        if djoser_settings.PASSWORD_CHANGED_EMAIL_CONFIRMATION:
            email_context = {"user": serializer.user}
            to = [get_user_email(serializer.user)]
            djoser_settings.EMAIL.password_changed_confirmation(
                request, email_context
            ).send(to)

        log_event(
            request,
            AuditAction.PASSWORD_RESET_CONFIRMED,
            user=serializer.user,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ActivationView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "activation"
    throttle_classes = [ScopedRateThrottle]

    def post(self, request, *args, **kwargs):
        serializer = ActivationSerializer(
            data=request.data, context={"request": request, "view": _ActivationViewContext()}
        )
        serializer.is_valid(raise_exception=True)
        serializer.user.is_active = True
        serializer.user.save()

        if djoser_settings.SEND_CONFIRMATION_EMAIL:
            email_context = {"user": serializer.user}
            to = [get_user_email(serializer.user)]
            djoser_settings.EMAIL.confirmation(request, email_context).send(to)

        log_event(request, AuditAction.USER_ACTIVATED, user=serializer.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
