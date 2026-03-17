import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.agencies.models import Agency, AgencyMembership, AgencyRole

User = get_user_model()


@pytest.fixture()
def api_client():
    return APIClient()


@pytest.fixture()
def user_password():
    return "S3cretPass#123"


def _create_user(phone, email, password, full_name="Test User"):
    return User.objects.create_user(
        phone_number=phone,
        full_name=full_name,
        email=email,
        password=password,
    )


def _login(api_client, login, password, agency_id=None):
    payload = {"login": login, "password": password}
    if agency_id:
        payload["agency_id"] = str(agency_id)
    response = api_client.post("/api/v1/auth/jwt/create/", payload, format="json")
    assert response.status_code == 200
    return response.data["access"]


@pytest.mark.django_db
def test_properties_require_agency_scope(api_client, user_password):
    user = _create_user("0700000100", "user@example.com", user_password, "User")
    agency_a = Agency.objects.create(name="Agence A", created_by=user)
    agency_b = Agency.objects.create(name="Agence B", created_by=user)
    AgencyMembership.objects.create(agency=agency_a, user=user, role=AgencyRole.OWNER)
    AgencyMembership.objects.create(agency=agency_b, user=user, role=AgencyRole.OWNER)

    access = _login(api_client, user.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = api_client.get("/api/v1/properties/")
    assert response.status_code == 403


@pytest.mark.django_db
def test_properties_scoped_by_header_and_token_claim(api_client, user_password):
    user = _create_user("0700000200", "owner@example.com", user_password, "Owner")
    agency_a = Agency.objects.create(name="Agence A", created_by=user)
    agency_b = Agency.objects.create(name="Agence B", created_by=user)
    AgencyMembership.objects.create(agency=agency_a, user=user, role=AgencyRole.OWNER)
    AgencyMembership.objects.create(agency=agency_b, user=user, role=AgencyRole.OWNER)

    access = _login(api_client, user.phone_number, user_password, agency_id=agency_a.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    payload = {
        "title": "Villa A",
        "address": "Ouaga",
        "city": "Ouaga",
        "property_type": "house",
        "rent_amount": "250000",
        "is_available": True,
    }
    create_a = api_client.post(
        "/api/v1/properties/",
        payload,
        format="json",
        HTTP_X_AGENCY_ID=str(agency_a.id),
    )
    assert create_a.status_code == 201

    payload_b = {
        "title": "Appartement B",
        "address": "Bobo",
        "city": "Bobo",
        "property_type": "apartment",
        "rent_amount": "150000",
        "is_available": True,
    }
    create_b = api_client.post(
        "/api/v1/properties/",
        payload_b,
        format="json",
        HTTP_X_AGENCY_ID=str(agency_b.id),
    )
    assert create_b.status_code == 201

    list_a = api_client.get(
        "/api/v1/properties/", HTTP_X_AGENCY_ID=str(agency_a.id)
    )
    assert list_a.status_code == 200
    assert len(list_a.data) == 1
    assert list_a.data[0]["id"] == create_a.data["id"]

    list_claim = api_client.get("/api/v1/properties/")
    assert list_claim.status_code == 200
    assert len(list_claim.data) == 1
    assert list_claim.data[0]["id"] == create_a.data["id"]

    outsider = _create_user("0700000201", "outsider@example.com", user_password, "Out")
    outsider_access = _login(api_client, outsider.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {outsider_access}")
    forbidden = api_client.get(
        "/api/v1/properties/", HTTP_X_AGENCY_ID=str(agency_a.id)
    )
    assert forbidden.status_code == 403


@pytest.mark.django_db
def test_viewer_cannot_create_or_update_property(api_client, user_password):
    owner = _create_user("0700000300", "owner@example.com", user_password, "Owner")
    viewer = _create_user("0700000301", "viewer@example.com", user_password, "Viewer")
    agency = Agency.objects.create(name="Agence Viewer", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)
    AgencyMembership.objects.create(agency=agency, user=viewer, role=AgencyRole.VIEWER)

    owner_access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {owner_access}")
    create = api_client.post(
        "/api/v1/properties/",
        {
            "title": "Villa X",
            "address": "Ouaga",
            "city": "Ouaga",
            "property_type": "house",
            "rent_amount": "200000",
            "is_available": True,
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert create.status_code == 201
    property_id = create.data["id"]

    viewer_access = _login(api_client, viewer.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {viewer_access}")

    create_forbidden = api_client.post(
        "/api/v1/properties/",
        {
            "title": "Villa Y",
            "address": "Bobo",
            "city": "Bobo",
            "property_type": "apartment",
            "rent_amount": "150000",
            "is_available": True,
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert create_forbidden.status_code == 403

    update_forbidden = api_client.patch(
        f"/api/v1/properties/{property_id}/",
        {"title": "Updated"},
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert update_forbidden.status_code == 403


@pytest.mark.django_db
def test_access_other_agency_forbidden(api_client, user_password):
    owner = _create_user("0700000400", "owner2@example.com", user_password, "Owner")
    agency_a = Agency.objects.create(name="Agence A", created_by=owner)
    agency_b = Agency.objects.create(name="Agence B", created_by=owner)
    AgencyMembership.objects.create(agency=agency_a, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = api_client.get(
        "/api/v1/properties/", HTTP_X_AGENCY_ID=str(agency_b.id)
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_building_create_and_property_link(api_client, user_password):
    owner = _create_user("0700000500", "owner3@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Bld", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    building = api_client.post(
        "/api/v1/buildings/",
        {"name": "Immeuble A", "address": "Ouaga", "city": "Ouaga", "total_floors": 3},
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert building.status_code == 201

    prop = api_client.post(
        "/api/v1/properties/",
        {
            "title": "Appartement 1A",
            "address": "Ouaga",
            "city": "Ouaga",
            "property_type": "apartment",
            "rent_amount": "120000",
            "is_available": True,
            "building": building.data["id"],
            "bedrooms": 2,
            "bathrooms": 1,
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert prop.status_code == 201


@pytest.mark.django_db
def test_building_cross_agency_forbidden(api_client, user_password):
    owner = _create_user("0700000600", "owner4@example.com", user_password, "Owner")
    agency_a = Agency.objects.create(name="Agence A", created_by=owner)
    agency_b = Agency.objects.create(name="Agence B", created_by=owner)
    AgencyMembership.objects.create(agency=agency_a, user=owner, role=AgencyRole.OWNER)
    AgencyMembership.objects.create(agency=agency_b, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    building = api_client.post(
        "/api/v1/buildings/",
        {"name": "Immeuble X", "address": "Ouaga", "city": "Ouaga"},
        format="json",
        HTTP_X_AGENCY_ID=str(agency_a.id),
    )
    assert building.status_code == 201

    prop = api_client.post(
        "/api/v1/properties/",
        {
            "title": "Appartement X",
            "address": "Ouaga",
            "city": "Ouaga",
            "property_type": "apartment",
            "rent_amount": "120000",
            "is_available": True,
            "building": building.data["id"],
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency_b.id),
    )
    assert prop.status_code == 400


@pytest.mark.django_db
def test_marketplace_listing_public_only_published(api_client, user_password):
    owner = _create_user("0700000700", "owner5@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Listing", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    prop = api_client.post(
        "/api/v1/properties/",
        {
            "title": "Villa Publique",
            "address": "Ouaga",
            "city": "Ouaga",
            "property_type": "house",
            "rent_amount": "250000",
            "is_available": True,
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert prop.status_code == 201

    draft = api_client.post(
        "/api/v1/listings/",
        {
            "property": prop.data["id"],
            "title": "Draft",
            "price": "250000",
            "currency": "XOF",
            "status": "draft",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert draft.status_code == 201

    published = api_client.patch(
        f"/api/v1/listings/{draft.data['id']}/",
        {"status": "published"},
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert 200 <= published.status_code < 300

    public = api_client.get("/api/v1/marketplace/listings/")
    assert public.status_code == 200
    assert len(public.data) == 1


@pytest.mark.django_db
def test_marketplace_filters_and_geolocation(api_client, user_password):
    owner = _create_user("0700000800", "owner6@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Filters", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password, agency_id=agency.id)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    prop_a = api_client.post(
        "/api/v1/properties/",
        {
            "title": "Villa Geo",
            "address": "Ouaga",
            "city": "Ouaga",
            "property_type": "house",
            "bedrooms": 3,
            "bathrooms": 2,
            "area_sqm": "120.0",
            "parking_spots": 1,
            "furnished": True,
            "has_pool": True,
            "latitude": "12.3710",
            "longitude": "-1.5197",
            "rent_amount": "300000",
            "is_available": True,
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert prop_a.status_code == 201

    prop_b = api_client.post(
        "/api/v1/properties/",
        {
            "title": "Studio B",
            "address": "Bobo",
            "city": "Bobo",
            "property_type": "apartment",
            "bedrooms": 1,
            "bathrooms": 1,
            "area_sqm": "45.0",
            "parking_spots": 0,
            "furnished": False,
            "has_pool": False,
            "latitude": "15.0000",
            "longitude": "-3.0000",
            "rent_amount": "150000",
            "is_available": True,
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert prop_b.status_code == 201

    listing_a = api_client.post(
        "/api/v1/listings/",
        {
            "property": prop_a.data["id"],
            "title": "Villa Geo",
            "price": "300000",
            "currency": "XOF",
            "status": "published",
            "is_featured": True,
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert listing_a.status_code == 201

    listing_b = api_client.post(
        "/api/v1/listings/",
        {
            "property": prop_b.data["id"],
            "title": "Studio Bobo",
            "price": "150000",
            "currency": "XOF",
            "status": "published",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert listing_b.status_code == 201

    all_listings = api_client.get("/api/v1/marketplace/listings/")
    assert all_listings.status_code == 200
    assert len(all_listings.data) == 2

    min_price = api_client.get("/api/v1/marketplace/listings/?min_price=250000")
    assert len(min_price.data) == 1
    assert min_price.data[0]["id"] == listing_a.data["id"]

    by_type = api_client.get("/api/v1/marketplace/listings/?property_type=apartment")
    assert len(by_type.data) == 1
    assert by_type.data[0]["id"] == listing_b.data["id"]

    by_bedrooms = api_client.get("/api/v1/marketplace/listings/?min_bedrooms=2")
    assert len(by_bedrooms.data) == 1
    assert by_bedrooms.data[0]["id"] == listing_a.data["id"]

    by_furnished = api_client.get("/api/v1/marketplace/listings/?furnished=true")
    assert len(by_furnished.data) == 1
    assert by_furnished.data[0]["id"] == listing_a.data["id"]

    by_parking = api_client.get("/api/v1/marketplace/listings/?has_parking=true")
    assert len(by_parking.data) == 1
    assert by_parking.data[0]["id"] == listing_a.data["id"]

    by_geo = api_client.get(
        "/api/v1/marketplace/listings/?lat_min=12.0&lat_max=13.0"
    )
    assert len(by_geo.data) == 1
    assert by_geo.data[0]["id"] == listing_a.data["id"]

    by_radius = api_client.get(
        "/api/v1/marketplace/listings/?lat=12.3710&lng=-1.5197&radius_km=5"
    )
    assert len(by_radius.data) == 1
    assert by_radius.data[0]["id"] == listing_a.data["id"]
    assert by_radius.data[0]["distance_km"] is not None
    assert by_radius.data[0]["distance_km"] <= 5


@pytest.mark.django_db
def test_room_create_and_scope(api_client, user_password):
    owner = _create_user("0700000900", "owner7@example.com", user_password, "Owner")
    agency = Agency.objects.create(name="Agence Rooms", created_by=owner)
    AgencyMembership.objects.create(agency=agency, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    prop = api_client.post(
        "/api/v1/properties/",
        {
            "title": "Villa Rooms",
            "address": "Ouaga",
            "city": "Ouaga",
            "property_type": "house",
            "rent_amount": "220000",
            "is_available": True,
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert prop.status_code == 201

    room = api_client.post(
        "/api/v1/rooms/",
        {
            "property": prop.data["id"],
            "name": "Chambre principale",
            "room_type": "bedroom",
            "floor_number": 1,
            "area_sqm": "18.5",
            "has_window": True,
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency.id),
    )
    assert room.status_code == 201

    rooms_list = api_client.get(
        "/api/v1/rooms/", HTTP_X_AGENCY_ID=str(agency.id)
    )
    assert rooms_list.status_code == 200
    assert len(rooms_list.data) == 1
    assert rooms_list.data[0]["id"] == room.data["id"]


@pytest.mark.django_db
def test_room_cross_agency_forbidden(api_client, user_password):
    owner = _create_user("0700000910", "owner8@example.com", user_password, "Owner")
    agency_a = Agency.objects.create(name="Agence A", created_by=owner)
    agency_b = Agency.objects.create(name="Agence B", created_by=owner)
    AgencyMembership.objects.create(agency=agency_a, user=owner, role=AgencyRole.OWNER)
    AgencyMembership.objects.create(agency=agency_b, user=owner, role=AgencyRole.OWNER)

    access = _login(api_client, owner.phone_number, user_password)
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    prop = api_client.post(
        "/api/v1/properties/",
        {
            "title": "Villa A",
            "address": "Ouaga",
            "city": "Ouaga",
            "property_type": "house",
            "rent_amount": "200000",
            "is_available": True,
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency_a.id),
    )
    assert prop.status_code == 201

    forbidden = api_client.post(
        "/api/v1/rooms/",
        {
            "property": prop.data["id"],
            "name": "Chambre B",
            "room_type": "bedroom",
        },
        format="json",
        HTTP_X_AGENCY_ID=str(agency_b.id),
    )
    assert forbidden.status_code == 400
