import hashlib
import hmac
import json

import requests
from django.conf import settings


class CinetPayError(Exception):
    pass


class CinetPayClient:
    def __init__(self):
        self.enabled = getattr(settings, "CINETPAY_ENABLED", False)
        self.api_key = getattr(settings, "CINETPAY_API_KEY", "")
        self.site_id = getattr(settings, "CINETPAY_SITE_ID", "")
        self.secret_key = getattr(settings, "CINETPAY_SECRET_KEY", "")
        self.base_url = getattr(settings, "CINETPAY_BASE_URL", "")
        self.check_url = getattr(settings, "CINETPAY_CHECK_URL", "")
        self.notify_url = getattr(settings, "CINETPAY_NOTIFY_URL", "")
        self.return_url = getattr(settings, "CINETPAY_RETURN_URL", "")
        self.channels = getattr(settings, "CINETPAY_CHANNELS", "ALL")
        self.lang = getattr(settings, "CINETPAY_LANG", "FR")
        self.customer_country = getattr(settings, "CINETPAY_CUSTOMER_COUNTRY", "BF")
        self.customer_city = getattr(settings, "CINETPAY_CUSTOMER_CITY", "Ouagadougou")
        self.customer_address = getattr(settings, "CINETPAY_CUSTOMER_ADDRESS", "N/A")
        self.customer_zip = getattr(settings, "CINETPAY_CUSTOMER_ZIP", "00000")
        self.customer_state = getattr(settings, "CINETPAY_CUSTOMER_STATE", "BF")

    def _post(self, url, payload):
        response = requests.post(url, json=payload, timeout=30)
        try:
            data = response.json()
        except Exception as exc:
            raise CinetPayError("Reponse CinetPay invalide.") from exc
        if response.status_code >= 400:
            raise CinetPayError(data.get("message") or "Erreur CinetPay.")
        return data

    def create_payment(self, *, transaction_id, amount, currency, description, customer):
        if not self.api_key or not self.site_id:
            raise CinetPayError("CINETPAY_API_KEY et CINETPAY_SITE_ID requis.")
        if not self.base_url:
            raise CinetPayError("CINETPAY_BASE_URL requis.")
        payload = {
            "apikey": self.api_key,
            "site_id": self.site_id,
            "transaction_id": transaction_id,
            "amount": int(amount),
            "currency": currency,
            "description": description,
            "notify_url": self.notify_url,
            "return_url": self.return_url,
            "channels": self.channels,
            "lang": self.lang,
            "customer_name": customer.get("name"),
            "customer_surname": customer.get("surname"),
            "customer_email": customer.get("email"),
            "customer_phone_number": customer.get("phone"),
            "customer_address": customer.get("address") or self.customer_address,
            "customer_city": customer.get("city") or self.customer_city,
            "customer_country": customer.get("country") or self.customer_country,
            "customer_state": customer.get("state") or self.customer_state,
            "customer_zip_code": customer.get("zip") or self.customer_zip,
        }
        return self._post(self.base_url, payload)

    def check_transaction(self, transaction_id):
        if not self.api_key or not self.site_id:
            raise CinetPayError("CINETPAY_API_KEY et CINETPAY_SITE_ID requis.")
        if not self.check_url:
            raise CinetPayError("CINETPAY_CHECK_URL requis.")
        payload = {
            "apikey": self.api_key,
            "site_id": self.site_id,
            "transaction_id": transaction_id,
        }
        return self._post(self.check_url, payload)

    def verify_hmac(self, payload, token):
        if not self.secret_key or not token:
            return None
        raw = json.dumps(payload, separators=(",", ":"), sort_keys=True)
        digest = hmac.new(
            self.secret_key.encode("utf-8"),
            raw.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(digest, token)
