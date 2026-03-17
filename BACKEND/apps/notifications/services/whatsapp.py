import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class WhatsAppService:
    def __init__(self, simulate=None, provider=None):
        self.simulate = (
            settings.WHATSAPP_SIMULATE if simulate is None else bool(simulate)
        )
        self.provider = provider or getattr(
            settings, "WHATSAPP_PROVIDER", "africastalking"
        )

    def send_message(self, to, message):
        if self.simulate:
            targets = [to] if isinstance(to, str) else list(to)
            logger.info("WhatsApp simulation -> to=%s message=%s", targets, message)
            return {
                "status": "simulated",
                "provider": self.provider,
                "to": targets,
                "message": message,
            }

        if self.provider != "africastalking":
            raise RuntimeError(
                "WhatsApp provider non configure. Activez WHATSAPP_SIMULATE ou utilisez 'africastalking'."
            )

        username = getattr(settings, "AFRICASTALKING_USERNAME", "")
        api_key = getattr(settings, "AFRICASTALKING_API_KEY", "")
        wa_number = getattr(settings, "AFRICASTALKING_WHATSAPP_NUMBER", "")
        if not username or not api_key or not wa_number:
            raise RuntimeError(
                "AFRICASTALKING_USERNAME/AFRICASTALKING_API_KEY/AFRICASTALKING_WHATSAPP_NUMBER requis."
            )

        try:
            import africastalking
        except ImportError as exc:
            raise RuntimeError(
                "Package 'africastalking' manquant. Installez-le en production."
            ) from exc

        africastalking.initialize(username, api_key)
        whatsapp = africastalking.Whatsapp

        targets = [to] if isinstance(to, str) else list(to)
        results = []
        for phone_number in targets:
            results.append(
                whatsapp.send(
                    body={"message": message},
                    wa_number=wa_number,
                    phone_number=phone_number,
                )
            )

        return {"status": "sent", "provider": self.provider, "results": results}

    def send_template(self, to, template_name, components, language="en", category="UTILITY"):
        if self.simulate:
            targets = [to] if isinstance(to, str) else list(to)
            logger.info(
                "WhatsApp template simulation -> to=%s template=%s components=%s",
                targets,
                template_name,
                components,
            )
            return {
                "status": "simulated",
                "provider": self.provider,
                "to": targets,
                "template": template_name,
                "components": components,
            }

        if self.provider != "africastalking":
            raise RuntimeError(
                "WhatsApp provider non configure. Activez WHATSAPP_SIMULATE ou utilisez 'africastalking'."
            )

        username = getattr(settings, "AFRICASTALKING_USERNAME", "")
        api_key = getattr(settings, "AFRICASTALKING_API_KEY", "")
        wa_number = getattr(settings, "AFRICASTALKING_WHATSAPP_NUMBER", "")
        if not username or not api_key or not wa_number:
            raise RuntimeError(
                "AFRICASTALKING_USERNAME/AFRICASTALKING_API_KEY/AFRICASTALKING_WHATSAPP_NUMBER requis."
            )

        try:
            import africastalking
        except ImportError as exc:
            raise RuntimeError(
                "Package 'africastalking' manquant. Installez-le en production."
            ) from exc

        africastalking.initialize(username, api_key)
        whatsapp = africastalking.Whatsapp

        return whatsapp.send_template(
            components=components,
            wa_number=wa_number,
            name=template_name,
            language=language,
            category=category,
        )
