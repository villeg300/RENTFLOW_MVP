from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string


def build_invitation_url(invitation):
    template = getattr(settings, "INVITATION_ACCEPT_URL", "")
    if template:
        return template.replace("{token}", str(invitation.token))

    protocol = getattr(settings, "FRONTEND_PROTOCOL", "http")
    domain = getattr(settings, "FRONTEND_DOMAIN", "localhost:3000")
    return f"{protocol}://{domain}/accept-invite?token={invitation.token}"


def send_invitation_email(invitation):
    inviter = invitation.invited_by
    subject = f"Invitation a rejoindre {invitation.agency.name}"
    accept_url = build_invitation_url(invitation)
    context = {
        "invitation": invitation,
        "agency": invitation.agency,
        "inviter": inviter,
        "accept_url": accept_url,
    }
    html_message = render_to_string("email/agency_invitation.html", context)
    text_message = render_to_string("email/agency_invitation.txt", context)
    send_mail(
        subject=subject,
        message=text_message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[invitation.email],
        html_message=html_message,
    )
