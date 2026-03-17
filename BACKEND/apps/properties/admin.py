from django.contrib import admin

from .models import Building, Listing, Property, Room


@admin.register(Building)
class BuildingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "agency",
        "city",
        "total_floors",
        "total_units",
        "created_at",
    )
    search_fields = ("name", "address", "city", "agency__name")
    list_filter = ("city", "created_at")


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "agency",
        "building",
        "property_type",
        "rent_amount",
        "is_available",
        "created_at",
    )
    search_fields = ("title", "address", "city", "agency__name")
    list_filter = ("property_type", "is_available", "created_at")


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "agency",
        "status",
        "price",
        "city",
        "created_at",
    )
    search_fields = ("title", "city", "agency__name")
    list_filter = ("status", "created_at")


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "room_type",
        "property",
        "floor_number",
        "area_sqm",
        "created_at",
    )
    search_fields = ("name", "property__title")
    list_filter = ("room_type", "created_at")
