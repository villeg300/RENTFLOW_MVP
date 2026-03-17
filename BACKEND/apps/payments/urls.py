from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import FinanceDashboardView, PaymentViewSet

router = DefaultRouter()
router.register("payments", PaymentViewSet, basename="payment")

finance_dashboard = FinanceDashboardView.as_view({"get": "list"})
finance_dashboard_export = FinanceDashboardView.as_view({"get": "export"})

urlpatterns = [
    *router.urls,
    path("dashboard/finance/", finance_dashboard, name="finance-dashboard"),
    path("dashboard/finance/export/", finance_dashboard_export, name="finance-dashboard-export"),
]
