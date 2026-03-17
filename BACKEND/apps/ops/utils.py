from contextlib import contextmanager

from django.utils import timezone

from .models import TaskRun, TaskRunStatus
from .notifications import send_task_failure_alert


@contextmanager
def track_task_run(task_name):
    task_run, _ = TaskRun.objects.get_or_create(task_name=task_name)
    start_at = timezone.now()
    task_run.last_started_at = start_at
    task_run.last_status = TaskRunStatus.RUNNING
    task_run.save(update_fields=["last_started_at", "last_status", "updated_at"])
    try:
        yield task_run
        task_run.run_count += 1
        task_run.mark_success()
    except Exception as exc:
        task_run.run_count += 1
        task_run.mark_failure(exc)
        send_task_failure_alert(task_name, exc)
        duration_ms = int((timezone.now() - start_at).total_seconds() * 1000)
        task_run.last_duration_ms = duration_ms
        task_run.save(
            update_fields=[
                "last_finished_at",
                "last_status",
                "last_error",
                "run_count",
                "last_duration_ms",
                "updated_at",
            ]
        )
        raise
    duration_ms = int((timezone.now() - start_at).total_seconds() * 1000)
    task_run.last_duration_ms = duration_ms
    task_run.save(
        update_fields=[
            "last_finished_at",
            "last_status",
            "last_error",
            "run_count",
            "last_duration_ms",
            "updated_at",
        ]
    )
