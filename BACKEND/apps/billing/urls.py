from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CinetPayWebhookView, InvoiceViewSet, PlanViewSet, SubscriptionViewSet

router = DefaultRouter()
router.register("billing/plans", PlanViewSet, basename="billing-plan")
router.register("billing/invoices", InvoiceViewSet, basename="billing-invoice")

subscription_view = SubscriptionViewSet.as_view({"get": "list", "post": "create"})
subscription_cancel = SubscriptionViewSet.as_view({"post": "cancel"})
subscription_resume = SubscriptionViewSet.as_view({"post": "resume"})
cinetpay_webhook = CinetPayWebhookView.as_view({"get": "list", "post": "create"})

urlpatterns = [
    *router.urls,
    path("billing/subscription/", subscription_view, name="billing-subscription"),
    path("billing/subscription/cancel/", subscription_cancel, name="billing-subscription-cancel"),
    path("billing/subscription/resume/", subscription_resume, name="billing-subscription-resume"),
    path("billing/cinetpay/webhook/", cinetpay_webhook, name="billing-cinetpay-webhook"),
]
