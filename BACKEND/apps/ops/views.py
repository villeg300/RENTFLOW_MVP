from datetime import timedelta

from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django_celery_beat.models import PeriodicTask

from .serializers import TaskRunSerializer
from .models import TaskRun


class TaskStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        now = timezone.now()
        task_runs = {run.task_name: run for run in TaskRun.objects.all()}
        payload = []
        tasks_qs = PeriodicTask.objects.all().order_by("name")

        only_failed = request.query_params.get("failed")
        if only_failed and only_failed.lower() in ("1", "true", "yes"):
            tasks_qs = tasks_qs.filter(enabled=True)

        for task in tasks_qs:
            schedule = task.schedule
            last_run_at = task.last_run_at or now
            _, next_in = schedule.is_due(last_run_at)
            next_run_at = now + timedelta(seconds=next_in)
            run = task_runs.get(task.task)
            item = (
                {
                    "name": task.name,
                    "task": task.task,
                    "enabled": task.enabled,
                    "last_run_at": task.last_run_at,
                    "next_run_at": next_run_at,
                    "schedule": str(schedule),
                    "last_status": run.last_status if run else None,
                    "last_started_at": run.last_started_at if run else None,
                    "last_finished_at": run.last_finished_at if run else None,
                    "run_count": run.run_count if run else 0,
                    "last_error": run.last_error if run else "",
                    "last_duration_ms": run.last_duration_ms if run else None,
                }
            )
            if only_failed and only_failed.lower() in ("1", "true", "yes"):
                if item["last_status"] != "failure":
                    continue
            payload.append(item)

        page = int(request.query_params.get("page", 1) or 1)
        page_size = int(request.query_params.get("page_size", 50) or 50)
        page_size = max(1, min(page_size, 200))
        start = (page - 1) * page_size
        end = start + page_size
        paged = payload[start:end]
        return Response(
            {
                "count": len(payload),
                "page": page,
                "page_size": page_size,
                "results": paged,
            }
        )
