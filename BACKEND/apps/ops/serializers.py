from rest_framework import serializers

from .models import TaskRun


class TaskRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskRun
        fields = (
            "task_name",
            "last_started_at",
            "last_finished_at",
            "last_status",
            "last_error",
            "run_count",
            "last_duration_ms",
        )
