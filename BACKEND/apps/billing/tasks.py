from celery import shared_task
from django.core.management import call_command

from apps.ops.utils import track_task_run


@shared_task
def expire_trials_task():
    with track_task_run("apps.billing.tasks.expire_trials_task"):
        call_command("expire_trials")
