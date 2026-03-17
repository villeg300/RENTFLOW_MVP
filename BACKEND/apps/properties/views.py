import math

from rest_framework import mixins, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.db.models import ExpressionWrapper, F, FloatField, Q, Value
from django.db.models.functions import (
    ACos,
    Cos,
    Coalesce,
    Greatest,
    Least,
    Radians,
    Sin,
)

from apps.agencies.mixins import AgencyScopedMixin
from apps.agencies.permissions import IsAgencyMember, IsAgencyOperator

from .models import Building, Listing, ListingStatus, Property, Room
from .serializers import (
    BuildingSerializer,
    ListingPublicSerializer,
    ListingSerializer,
    PropertySerializer,
    RoomSerializer,
)


class BuildingViewSet(AgencyScopedMixin, viewsets.ModelViewSet):
    queryset = Building.objects.all()
    serializer_class = BuildingSerializer
    permission_classes = [IsAuthenticated, IsAgencyMember]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAgencyOperator()]
        return super().get_permissions()


class PropertyViewSet(AgencyScopedMixin, viewsets.ModelViewSet):
    queryset = Property.objects.all()
    serializer_class = PropertySerializer
    permission_classes = [IsAuthenticated, IsAgencyMember]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAgencyOperator()]
        return super().get_permissions()


class ListingViewSet(AgencyScopedMixin, viewsets.ModelViewSet):
    queryset = Listing.objects.select_related("property")
    serializer_class = ListingSerializer
    permission_classes = [IsAuthenticated, IsAgencyMember]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAgencyOperator()]
        return super().get_permissions()


class PublicListingViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = Listing.objects.filter(status=ListingStatus.PUBLISHED).select_related(
        "property"
    )
    serializer_class = ListingPublicSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        city = params.get("city")
        if city:
            queryset = queryset.filter(
                Q(city__iexact=city) | Q(property__city__iexact=city)
            )

        min_price = params.get("min_price")
        if min_price:
            queryset = queryset.filter(price__gte=min_price)

        max_price = params.get("max_price")
        if max_price:
            queryset = queryset.filter(price__lte=max_price)

        property_type = params.get("property_type")
        if property_type:
            queryset = queryset.filter(property__property_type=property_type)

        min_bedrooms = params.get("min_bedrooms")
        if min_bedrooms:
            queryset = queryset.filter(property__bedrooms__gte=min_bedrooms)

        max_bedrooms = params.get("max_bedrooms")
        if max_bedrooms:
            queryset = queryset.filter(property__bedrooms__lte=max_bedrooms)

        min_bathrooms = params.get("min_bathrooms")
        if min_bathrooms:
            queryset = queryset.filter(property__bathrooms__gte=min_bathrooms)

        max_bathrooms = params.get("max_bathrooms")
        if max_bathrooms:
            queryset = queryset.filter(property__bathrooms__lte=max_bathrooms)

        min_area = params.get("min_area")
        if min_area:
            queryset = queryset.filter(property__area_sqm__gte=min_area)

        max_area = params.get("max_area")
        if max_area:
            queryset = queryset.filter(property__area_sqm__lte=max_area)

        furnished = params.get("furnished")
        if furnished is not None:
            if furnished.lower() in ("true", "1", "yes"):
                queryset = queryset.filter(property__furnished=True)
            elif furnished.lower() in ("false", "0", "no"):
                queryset = queryset.filter(property__furnished=False)

        has_parking = params.get("has_parking")
        if has_parking is not None:
            if has_parking.lower() in ("true", "1", "yes"):
                queryset = queryset.filter(property__parking_spots__gt=0)
            elif has_parking.lower() in ("false", "0", "no"):
                queryset = queryset.filter(property__parking_spots=0)

        has_pool = params.get("has_pool")
        if has_pool is not None:
            if has_pool.lower() in ("true", "1", "yes"):
                queryset = queryset.filter(property__has_pool=True)
            elif has_pool.lower() in ("false", "0", "no"):
                queryset = queryset.filter(property__has_pool=False)

        is_featured = params.get("is_featured")
        if is_featured is not None:
            if is_featured.lower() in ("true", "1", "yes"):
                queryset = queryset.filter(is_featured=True)
            elif is_featured.lower() in ("false", "0", "no"):
                queryset = queryset.filter(is_featured=False)

        q = params.get("q")
        if q:
            queryset = queryset.filter(
                Q(title__icontains=q) | Q(description__icontains=q)
            )

        lat_min = params.get("lat_min")
        if lat_min:
            queryset = queryset.filter(
                Q(latitude__gte=lat_min)
                | Q(latitude__isnull=True, property__latitude__gte=lat_min)
            )

        lat_max = params.get("lat_max")
        if lat_max:
            queryset = queryset.filter(
                Q(latitude__lte=lat_max)
                | Q(latitude__isnull=True, property__latitude__lte=lat_max)
            )

        lng_min = params.get("lng_min")
        if lng_min:
            queryset = queryset.filter(
                Q(longitude__gte=lng_min)
                | Q(longitude__isnull=True, property__longitude__gte=lng_min)
            )

        lng_max = params.get("lng_max")
        if lng_max:
            queryset = queryset.filter(
                Q(longitude__lte=lng_max)
                | Q(longitude__isnull=True, property__longitude__lte=lng_max)
            )

        lat = params.get("lat")
        lng = params.get("lng")
        radius_km = params.get("radius_km")
        if any([lat, lng, radius_km]):
            if not all([lat, lng, radius_km]):
                raise ValidationError(
                    "lat, lng et radius_km sont requis pour le filtre par rayon."
                )
            try:
                lat = float(lat)
                lng = float(lng)
                radius_km = float(radius_km)
            except (TypeError, ValueError):
                raise ValidationError(
                    "lat, lng et radius_km doivent etre des nombres valides."
                )
            if radius_km <= 0:
                raise ValidationError("radius_km doit etre superieur a 0.")

            lat_value = Coalesce("latitude", "property__latitude")
            lon_value = Coalesce("longitude", "property__longitude")

            queryset = queryset.annotate(_lat=lat_value, _lon=lon_value).exclude(
                _lat__isnull=True, _lon__isnull=True
            )

            lat_delta = radius_km / 111.0
            if abs(lat) < 89.9:
                lon_delta = radius_km / (111.0 * math.cos(math.radians(lat)))
            else:
                lon_delta = radius_km / 111.0

            queryset = queryset.filter(
                _lat__gte=lat - lat_delta,
                _lat__lte=lat + lat_delta,
                _lon__gte=lng - lon_delta,
                _lon__lte=lng + lon_delta,
            )

            lat_rad = Radians(Value(lat))
            lon_rad = Radians(Value(lng))
            acos_arg = (
                Sin(lat_rad) * Sin(Radians(F("_lat")))
                + Cos(lat_rad) * Cos(Radians(F("_lat")))
                * Cos(Radians(F("_lon")) - lon_rad)
            )
            acos_arg = Least(Greatest(acos_arg, Value(-1.0)), Value(1.0))
            distance_expr = ExpressionWrapper(
                ACos(acos_arg) * Value(6371.0), output_field=FloatField()
            )
            queryset = queryset.annotate(distance_km=distance_expr).filter(
                distance_km__lte=radius_km
            )

        return queryset


class RoomViewSet(AgencyScopedMixin, viewsets.ModelViewSet):
    queryset = Room.objects.select_related("property")
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated, IsAgencyMember]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAuthenticated(), IsAgencyOperator()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super(AgencyScopedMixin, self).get_queryset()
        return queryset.filter(property__agency=self.get_agency())

    def perform_create(self, serializer):
        self.get_agency()
        serializer.save()
