import uuid

from django.db import models
from django.utils import timezone

from apps.agencies.models import Agency


class PropertyType(models.TextChoices):
    HOUSE = "house", "House"
    APARTMENT = "apartment", "Apartment"
    ROOM = "room", "Room"
    LAND = "land", "Land"
    OFFICE = "office", "Office"
    SHOP = "shop", "Shop"
    WAREHOUSE = "warehouse", "Warehouse"


class RoomType(models.TextChoices):
    BEDROOM = "bedroom", "Bedroom"
    BATHROOM = "bathroom", "Bathroom"
    LIVING = "living", "Living room"
    KITCHEN = "kitchen", "Kitchen"
    OFFICE = "office", "Office"
    STORAGE = "storage", "Storage"
    OTHER = "other", "Other"


class ListingStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class Building(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agency = models.ForeignKey(
        Agency, on_delete=models.CASCADE, related_name="buildings"
    )
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100, blank=True)
    total_floors = models.PositiveIntegerField(default=0)
    total_units = models.PositiveIntegerField(default=0)
    year_built = models.PositiveIntegerField(null=True, blank=True)
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    description = models.TextField(blank=True)
    amenities = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Building"
        verbose_name_plural = "Buildings"

    def __str__(self):
        return f"{self.name} ({self.city})"


class Property(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agency = models.ForeignKey(
        Agency, on_delete=models.CASCADE, related_name="properties"
    )
    building = models.ForeignKey(
        Building, on_delete=models.SET_NULL, null=True, blank=True, related_name="units"
    )
    title = models.CharField(max_length=255)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=100, blank=True)
    unit_number = models.CharField(max_length=50, blank=True)
    floor_number = models.IntegerField(null=True, blank=True)
    property_type = models.CharField(
        max_length=20, choices=PropertyType.choices, default=PropertyType.HOUSE
    )
    bedrooms = models.PositiveIntegerField(default=0)
    bathrooms = models.PositiveIntegerField(default=0)
    living_rooms = models.PositiveIntegerField(default=0)
    kitchens = models.PositiveIntegerField(default=0)
    toilets = models.PositiveIntegerField(default=0)
    parking_spots = models.PositiveIntegerField(default=0)
    area_sqm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    furnished = models.BooleanField(default=False)
    has_balcony = models.BooleanField(default=False)
    has_terrace = models.BooleanField(default=False)
    has_garden = models.BooleanField(default=False)
    has_storage = models.BooleanField(default=False)
    has_elevator = models.BooleanField(default=False)
    has_pool = models.BooleanField(default=False)
    has_air_conditioning = models.BooleanField(default=False)
    water_included = models.BooleanField(default=False)
    electricity_included = models.BooleanField(default=False)
    internet_included = models.BooleanField(default=False)
    security_included = models.BooleanField(default=False)
    amenities = models.JSONField(default=list, blank=True)
    photos = models.JSONField(default=list, blank=True)
    rent_amount = models.DecimalField(max_digits=12, decimal_places=2)
    is_available = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Property"
        verbose_name_plural = "Properties"

    def __str__(self):
        return f"{self.title} ({self.agency})"


class Listing(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agency = models.ForeignKey(
        Agency, on_delete=models.CASCADE, related_name="listings"
    )
    property = models.OneToOneField(
        Property, on_delete=models.CASCADE, related_name="listing"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    public_address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True
    )
    price = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default="XOF")
    status = models.CharField(
        max_length=20, choices=ListingStatus.choices, default=ListingStatus.DRAFT
    )
    published_at = models.DateTimeField(null=True, blank=True)
    available_from = models.DateField(null=True, blank=True)
    contact_name = models.CharField(max_length=255, blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    contact_email = models.EmailField(blank=True)
    is_featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Listing"
        verbose_name_plural = "Listings"

    def __str__(self):
        return f"{self.title} ({self.status})"


class Room(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    property = models.ForeignKey(
        Property, on_delete=models.CASCADE, related_name="rooms"
    )
    name = models.CharField(max_length=255)
    room_type = models.CharField(
        max_length=20, choices=RoomType.choices, default=RoomType.OTHER
    )
    floor_number = models.IntegerField(null=True, blank=True)
    area_sqm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    has_window = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Room"
        verbose_name_plural = "Rooms"

    def __str__(self):
        return f"{self.name} - {self.property}"
