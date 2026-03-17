from django.contrib import admin

from .models import TaskRun


@admin.register(TaskRun)
class TaskRunAdmin(admin.ModelAdmin):
    list_display = (
        "task_name",
        "last_status",
        "last_started_at",
        "last_finished_at",
        "last_duration_ms",
        "run_count",
    )
    list_filter = ("last_status",)
    search_fields = ("task_name",)
