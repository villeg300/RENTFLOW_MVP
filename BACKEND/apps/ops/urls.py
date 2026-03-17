from django.urls import path

from .views import TaskStatusView


urlpatterns = [
    path("ops/tasks/", TaskStatusView.as_view(), name="ops-tasks-status"),
]
