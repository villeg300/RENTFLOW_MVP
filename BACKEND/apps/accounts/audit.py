from .models import AuditLog


def log_event(request, action, user=None, metadata=None):
    if metadata is None:
        metadata = {}

    ip_address = request.META.get("REMOTE_ADDR")
    user_agent = request.META.get("HTTP_USER_AGENT", "")

    AuditLog.objects.create(
        user=user,
        action=action,
        ip_address=ip_address,
        user_agent=user_agent,
        metadata=metadata,
    )
