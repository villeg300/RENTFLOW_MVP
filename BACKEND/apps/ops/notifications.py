import logging

from django.conf import settings
from django.core.mail import send_mail


def send_task_failure_alert(task_name, error, recipients=None):
    if not getattr(settings, "OPS_ALERTS_ENABLED", False):
        return

    recipients = recipients or getattr(settings, "OPS_ALERTS_EMAILS", [])
    if not recipients:
        return

    subject = f"[RentFlow] Task failed: {task_name}"
    body = f"Tache: {task_name}\nErreur: {error}"
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, recipients)
    except Exception:
        logging.getLogger(__name__).exception("Failed to send ops alert email")
