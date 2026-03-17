import pytest


@pytest.fixture(autouse=True)
def _allow_testserver_host(settings):
    if "testserver" not in settings.ALLOWED_HOSTS:
        settings.ALLOWED_HOSTS.append("testserver")

    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    # Disable throttling & axes during tests to avoid 429s.
    settings.AXES_ENABLED = False
    rest_framework = getattr(settings, "REST_FRAMEWORK", {}).copy()
    rest_framework["DEFAULT_THROTTLE_CLASSES"] = []
    rest_framework["DEFAULT_THROTTLE_RATES"] = {
        "login": "1000000/hour",
        "password_reset": "1000000/hour",
        "activation": "1000000/hour",
        "anon": "1000000/hour",
        "user": "1000000/hour",
    }
    settings.REST_FRAMEWORK = rest_framework
