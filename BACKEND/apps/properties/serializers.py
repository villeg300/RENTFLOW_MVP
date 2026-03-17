from rest_framework import serializers
from django.utils import timezone

from .models import Building, Listing, ListingStatus, Property, Room


class BuildingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Building
        fields = (
            "id",
            "agency",
            "name",
            "address",
            "city",
            "total_floors",
            "total_units",
            "year_built",
            "latitude",
            "longitude",
            "description",
            "amenities",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "agency", "created_at", "updated_at")


class PropertySerializer(serializers.ModelSerializer):
    class Meta:
        model = Property
        fields = (
            "id",
            "agency",
            "building",
            "title",
            "address",
            "city",
            "unit_number",
            "floor_number",
            "property_type",
            "bedrooms",
            "bathrooms",
            "living_rooms",
            "kitchens",
            "toilets",
            "parking_spots",
            "area_sqm",
            "latitude",
            "longitude",
            "furnished",
            "has_balcony",
            "has_terrace",
            "has_garden",
            "has_storage",
            "has_elevator",
            "has_pool",
            "has_air_conditioning",
            "water_included",
            "electricity_included",
            "internet_included",
            "security_included",
            "amenities",
            "photos",
            "rent_amount",
            "is_available",
            "description",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "agency", "created_at", "updated_at")

    def validate_building(self, value):
        agency = self.context.get("agency")
        if not agency:
            request = self.context.get("request")
            agency = getattr(request, "agency", None) if request else None
        if value and agency and value.agency_id != agency.id:
            raise serializers.ValidationError(
                "Cet immeuble n'appartient pas a l'agence active."
            )
        return value


class ListingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Listing
        fields = (
            "id",
            "agency",
            "property",
            "title",
            "description",
            "public_address",
            "city",
            "latitude",
            "longitude",
            "price",
            "currency",
            "status",
            "published_at",
            "available_from",
            "contact_name",
            "contact_phone",
            "contact_email",
            "is_featured",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "agency", "created_at", "updated_at")

    def validate_property(self, value):
        agency = self.context.get("agency")
        if not agency:
            request = self.context.get("request")
            agency = getattr(request, "agency", None) if request else None
        if agency and value.agency_id != agency.id:
            raise serializers.ValidationError(
                "Ce bien n'appartient pas a l'agence active."
            )
        return value

    def validate(self, attrs):
        status = attrs.get("status")
        if status == ListingStatus.PUBLISHED and not attrs.get("published_at"):
            attrs["published_at"] = timezone.now()
        return attrs


class ListingPublicSerializer(serializers.ModelSerializer):
    latitude = serializers.SerializerMethodField()
    longitude = serializers.SerializerMethodField()
    distance_km = serializers.SerializerMethodField()
    property_type = serializers.CharField(source="property.property_type", read_only=True)
    bedrooms = serializers.IntegerField(source="property.bedrooms", read_only=True)
    bathrooms = serializers.IntegerField(source="property.bathrooms", read_only=True)
    area_sqm = serializers.DecimalField(
        source="property.area_sqm",
        read_only=True,
        max_digits=10,
        decimal_places=2,
        allow_null=True,
    )
    parking_spots = serializers.IntegerField(
        source="property.parking_spots", read_only=True
    )
    furnished = serializers.BooleanField(source="property.furnished", read_only=True)
    has_balcony = serializers.BooleanField(source="property.has_balcony", read_only=True)
    has_pool = serializers.BooleanField(source="property.has_pool", read_only=True)

    class Meta:
        model = Listing
        fields = (
            "id",
            "title",
            "description",
            "public_address",
            "city",
            "latitude",
            "longitude",
            "distance_km",
            "price",
            "currency",
            "published_at",
            "available_from",
            "contact_name",
            "contact_phone",
            "contact_email",
            "property_type",
            "bedrooms",
            "bathrooms",
            "area_sqm",
            "parking_spots",
            "furnished",
            "has_balcony",
            "has_pool",
        )

    def get_latitude(self, obj):
        if obj.latitude is not None:
            return obj.latitude
        return getattr(obj.property, "latitude", None)

    def get_longitude(self, obj):
        if obj.longitude is not None:
            return obj.longitude
        return getattr(obj.property, "longitude", None)

    def get_distance_km(self, obj):
        value = getattr(obj, "distance_km", None)
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None


class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = (
            "id",
            "property",
            "name",
            "room_type",
            "floor_number",
            "area_sqm",
            "has_window",
            "description",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_property(self, value):
        agency = self.context.get("agency")
        if not agency:
            request = self.context.get("request")
            agency = getattr(request, "agency", None) if request else None
        if agency and value.agency_id != agency.id:
            raise serializers.ValidationError(
                "Ce bien n'appartient pas a l'agence active."
            )
        return value
