from celery import shared_task
from django.core.management import call_command

from apps.ops.utils import track_task_run


@shared_task
def send_rent_reminders_task():
    with track_task_run("apps.notifications.tasks.send_rent_reminders_task"):
        call_command("send_rent_reminders")
