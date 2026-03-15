from djoser import signals as djoser_signals
from django.dispatch import receiver

from .audit import log_event
from .models import AuditAction


@receiver(djoser_signals.user_registered)
def _audit_user_registered(sender, user, request, **kwargs):
    if request:
        log_event(request, AuditAction.USER_REGISTERED, user=user)


@receiver(djoser_signals.user_activated)
def _audit_user_activated(sender, user, request, **kwargs):
    if request:
        log_event(request, AuditAction.USER_ACTIVATED, user=user)
