from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    NotificationBulkReminderView,
    NotificationDashboardView,
    NotificationLogViewSet,
)

router = DefaultRouter()
router.register("notifications/logs", NotificationLogViewSet, basename="notification-log")

dashboard = NotificationDashboardView.as_view({"get": "list"})
bulk_reminder = NotificationBulkReminderView.as_view({"post": "create"})

urlpatterns = [
    *router.urls,
    path("notifications/dashboard/", dashboard, name="notifications-dashboard"),
    path("notifications/reminders/bulk/", bulk_reminder, name="notifications-reminders-bulk"),
]
