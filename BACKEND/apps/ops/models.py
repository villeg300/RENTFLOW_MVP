import uuid

from django.db import models
from django.utils import timezone


class TaskRunStatus(models.TextChoices):
    RUNNING = "running", "Running"
    SUCCESS = "success", "Success"
    FAILURE = "failure", "Failure"


class TaskRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task_name = models.CharField(max_length=255, unique=True)
    last_started_at = models.DateTimeField(null=True, blank=True)
    last_finished_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(
        max_length=20, choices=TaskRunStatus.choices, default=TaskRunStatus.SUCCESS
    )
    last_error = models.TextField(blank=True)
    run_count = models.PositiveIntegerField(default=0)
    last_duration_ms = models.PositiveIntegerField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["task_name"]
        verbose_name = "Task run"
        verbose_name_plural = "Task runs"

    def mark_running(self):
        self.last_started_at = timezone.now()
        self.last_status = TaskRunStatus.RUNNING

    def mark_success(self):
        self.last_finished_at = timezone.now()
        self.last_status = TaskRunStatus.SUCCESS
        self.last_error = ""

    def mark_failure(self, error):
        self.last_finished_at = timezone.now()
        self.last_status = TaskRunStatus.FAILURE
        self.last_error = str(error)[:2000]
