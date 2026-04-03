from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    NotificationBulkReminderView,
    NotificationDashboardView,
    NotificationLogViewSet,
    NotificationReminderQueueView,
)

router = DefaultRouter()
router.register("notifications/logs", NotificationLogViewSet, basename="notification-log")

dashboard = NotificationDashboardView.as_view({"get": "list"})
bulk_reminder = NotificationBulkReminderView.as_view({"post": "create"})
reminder_queue = NotificationReminderQueueView.as_view({"get": "list"})

urlpatterns = [
    *router.urls,
    path("notifications/dashboard/", dashboard, name="notifications-dashboard"),
    path("notifications/reminders/queue/", reminder_queue, name="notifications-reminders-queue"),
    path("notifications/reminders/bulk/", bulk_reminder, name="notifications-reminders-bulk"),
]
