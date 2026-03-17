from django.core.management.base import BaseCommand
from django.conf import settings

from django_celery_beat.models import CrontabSchedule, PeriodicTask


class Command(BaseCommand):
    help = "Cree ou met a jour les periodic tasks pour Celery Beat."

    def handle(self, *args, **options):
        tz = settings.TIME_ZONE

        reminders_schedule, _ = CrontabSchedule.objects.get_or_create(
            minute="0",
            hour="8",
            day_of_week="*",
            day_of_month="*",
            month_of_year="*",
            timezone=tz,
        )
        trials_schedule, _ = CrontabSchedule.objects.get_or_create(
            minute="0",
            hour="1",
            day_of_week="*",
            day_of_month="*",
            month_of_year="*",
            timezone=tz,
        )

        PeriodicTask.objects.update_or_create(
            name="send_rent_reminders_daily",
            defaults={
                "task": "apps.notifications.tasks.send_rent_reminders_task",
                "crontab": reminders_schedule,
                "enabled": True,
            },
        )

        PeriodicTask.objects.update_or_create(
            name="expire_trials_daily",
            defaults={
                "task": "apps.billing.tasks.expire_trials_task",
                "crontab": trials_schedule,
                "enabled": True,
            },
        )

        self.stdout.write(self.style.SUCCESS("Periodic tasks updated."))
