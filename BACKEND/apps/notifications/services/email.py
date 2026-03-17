from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string


class EmailService:
    def send_email(
        self,
        subject,
        to,
        template_txt,
        context,
        template_html=None,
        attachments=None,
    ):
        body_txt = render_to_string(template_txt, context)
        body_html = (
            render_to_string(template_html, context) if template_html else None
        )

        email = EmailMultiAlternatives(
            subject=subject,
            body=body_txt,
            to=[to] if isinstance(to, str) else list(to),
        )
        if body_html:
            email.attach_alternative(body_html, "text/html")
        for attachment in attachments or []:
            email.attach(*attachment)
        email.send()
