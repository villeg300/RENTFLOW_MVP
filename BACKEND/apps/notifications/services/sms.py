import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class SMSService:
    def __init__(self, simulate=None, provider=None):
        self.simulate = (
            settings.SMS_SIMULATE if simulate is None else bool(simulate)
        )
        self.provider = provider or getattr(settings, "SMS_PROVIDER", "africastalking")
        self.sender_id = getattr(settings, "AFRICASTALKING_SENDER_ID", "") or None

    def send_sms(self, to, message, sender_id=None):
        if self.simulate:
            targets = [to] if isinstance(to, str) else list(to)
            logger.info("SMS simulation -> to=%s message=%s", targets, message)
            return {
                "status": "simulated",
                "provider": self.provider,
                "to": targets,
                "message": message,
            }

        if self.provider != "africastalking":
            raise ValueError(f"Unsupported SMS_PROVIDER: {self.provider}")

        username = getattr(settings, "AFRICASTALKING_USERNAME", "")
        api_key = getattr(settings, "AFRICASTALKING_API_KEY", "")
        if not username or not api_key:
            raise RuntimeError(
                "AFRICASTALKING_USERNAME/AFRICASTALKING_API_KEY non configures."
            )

        try:
            import africastalking
        except ImportError as exc:
            raise RuntimeError(
                "Package 'africastalking' manquant. Installez-le en production."
            ) from exc

        africastalking.initialize(username, api_key)
        sms = africastalking.SMS

        targets = [to] if isinstance(to, str) else list(to)
        payload = {"to": targets, "message": message}
        sender = sender_id or self.sender_id
        if sender:
            payload["from_"] = sender
        return sms.send(**payload)
