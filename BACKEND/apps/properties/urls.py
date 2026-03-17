from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BuildingViewSet,
    ListingViewSet,
    PropertyViewSet,
    PublicListingViewSet,
    RoomViewSet,
)

router = DefaultRouter()
router.register("buildings", BuildingViewSet, basename="building")
router.register("properties", PropertyViewSet, basename="property")
router.register("listings", ListingViewSet, basename="listing")
router.register("rooms", RoomViewSet, basename="room")

public_listings = PublicListingViewSet.as_view({"get": "list"})
public_listing_detail = PublicListingViewSet.as_view({"get": "retrieve"})

urlpatterns = [
    *router.urls,
    path("marketplace/listings/", public_listings, name="marketplace-listings"),
    path(
        "marketplace/listings/<uuid:pk>/",
        public_listing_detail,
        name="marketplace-listing-detail",
    ),
]
