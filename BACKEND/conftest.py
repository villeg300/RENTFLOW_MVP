import pytest


@pytest.fixture(autouse=True)
def _allow_testserver_host(settings):
    if "testserver" not in settings.ALLOWED_HOSTS:
        settings.ALLOWED_HOSTS.append("testserver")

    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
