from rest_framework.routers import DefaultRouter

from .views import LeaseViewSet, TenantViewSet

router = DefaultRouter()
router.register("leases", LeaseViewSet, basename="lease")
router.register("tenants", TenantViewSet, basename="tenant")

urlpatterns = router.urls
