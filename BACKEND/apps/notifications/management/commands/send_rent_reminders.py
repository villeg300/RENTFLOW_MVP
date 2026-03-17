from django.core.management.base import BaseCommand

from apps.notifications.services.reminders import send_rent_reminders


class Command(BaseCommand):
    help = "Envoie les rappels de loyers (J-3, J, J+3)."

    def handle(self, *args, **options):
        send_rent_reminders()
        self.stdout.write(self.style.SUCCESS("Rappels envoyes."))
