import random
import re
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from faker import Faker

from apps.agencies.models import Agency, AgencyMembership, AgencyRole
from apps.leases.models import Lease, LeaseStatus, Tenant
from apps.notifications.models import NotificationChannel, NotificationLog, NotificationStatus
from apps.payments.models import Payment, PaymentStatus
from apps.properties.models import Building, Listing, ListingStatus, Property, PropertyType


class Command(BaseCommand):
    help = "Peuple la base avec des donnees realistes (agences, biens, baux, paiements, notifications)."

    def add_arguments(self, parser):
        parser.add_argument("--seed", type=int, default=None, help="Seed aleatoire")
        parser.add_argument("--clear", action="store_true", help="Supprimer les donnees existantes (hors superusers)")
        parser.add_argument("--agencies", type=int, default=2)
        parser.add_argument("--users", type=int, default=3, help="Utilisateurs par agence (inclut le owner)")
        parser.add_argument("--properties", type=int, default=20)
        parser.add_argument("--tenants", type=int, default=30)
        parser.add_argument("--leases", type=int, default=20)
        parser.add_argument("--payments", type=int, default=60)
        parser.add_argument("--notifications", type=int, default=40)

    def handle(self, *args, **options):
        seed = options.get("seed")
        faker = Faker("fr_FR")
        if seed is not None:
            random.seed(seed)
            Faker.seed(seed)
            faker.seed_instance(seed)

        if options.get("clear"):
            self._clear_data()

        agencies_count = options["agencies"]
        users_per_agency = max(options["users"], 1)

        with transaction.atomic():
            for _ in range(agencies_count):
                owner = self._create_user(faker)
                agency = Agency.objects.create(
                    name=faker.company(),
                    email=faker.unique.email(),
                    phone_number=self._fake_phone(faker),
                    address=faker.address().replace("\n", ", "),
                    created_by=owner,
                )
                AgencyMembership.objects.create(
                    agency=agency, user=owner, role=AgencyRole.OWNER
                )

                # Membres supplementaires
                for _ in range(users_per_agency - 1):
                    member = self._create_user(faker)
                    role = random.choice(
                        [AgencyRole.MANAGER, AgencyRole.AGENT, AgencyRole.VIEWER]
                    )
                    AgencyMembership.objects.create(
                        agency=agency, user=member, role=role
                    )

                buildings = self._create_buildings(faker, agency)
                properties = self._create_properties(
                    faker, agency, buildings, count=options["properties"]
                )
                tenants = self._create_tenants(
                    faker, agency, count=options["tenants"]
                )
                leases = self._create_leases(
                    faker, agency, properties, tenants, count=options["leases"]
                )
                self._create_payments(
                    faker, agency, leases, count=options["payments"]
                )
                self._create_notifications(
                    faker, agency, leases, count=options["notifications"]
                )

        self.stdout.write(self.style.SUCCESS("Seed termine."))

    def _clear_data(self):
        NotificationLog.objects.all().delete()
        Payment.objects.all().delete()
        Lease.objects.all().delete()
        Tenant.objects.all().delete()
        Listing.objects.all().delete()
        Property.objects.all().delete()
        Building.objects.all().delete()
        AgencyMembership.objects.all().delete()
        Agency.objects.all().delete()
        User = get_user_model()
        User.objects.filter(is_superuser=False).delete()

    def _fake_phone(self, faker):
        phone = re.sub(r"\D", "", faker.unique.msisdn())
        return phone[:15] if phone else f"01{faker.unique.random_number(digits=8)}"

    def _create_user(self, faker):
        User = get_user_model()
        phone = self._fake_phone(faker)
        email = faker.unique.email()
        full_name = faker.name()
        user = User.objects.create_user(
            phone_number=phone,
            full_name=full_name,
            email=email,
            password="Password123!",
        )
        return user

    def _create_buildings(self, faker, agency):
        buildings = []
        for _ in range(random.randint(1, 3)):
            buildings.append(
                Building.objects.create(
                    agency=agency,
                    name=f"{faker.company()} Résidence",
                    address=faker.address().replace("\n", ", "),
                    city=faker.city(),
                    total_floors=random.randint(1, 6),
                    total_units=random.randint(10, 40),
                    year_built=random.randint(1995, timezone.now().year),
                    description=faker.sentence(),
                )
            )
        return buildings

    def _create_properties(self, faker, agency, buildings, count):
        properties = []
        for _ in range(count):
            property_type = random.choice([choice[0] for choice in PropertyType.choices])
            rent_amount = random.randint(80_000, 450_000)
            building = random.choice(buildings) if buildings and random.random() < 0.6 else None

            prop = Property.objects.create(
                agency=agency,
                building=building,
                title=f"{faker.street_name()} {faker.building_number()}",
                address=faker.address().replace("\n", ", "),
                city=faker.city(),
                unit_number=str(random.randint(1, 120)) if building else "",
                floor_number=random.randint(0, 8) if building else None,
                property_type=property_type,
                bedrooms=random.randint(1, 4),
                bathrooms=random.randint(1, 3),
                living_rooms=random.randint(1, 2),
                kitchens=1,
                toilets=random.randint(1, 3),
                parking_spots=random.randint(0, 2),
                area_sqm=random.randint(35, 200),
                furnished=random.random() < 0.2,
                has_balcony=random.random() < 0.3,
                has_terrace=random.random() < 0.1,
                has_garden=random.random() < 0.15,
                has_storage=random.random() < 0.25,
                has_elevator=random.random() < 0.4,
                has_pool=random.random() < 0.05,
                has_air_conditioning=random.random() < 0.35,
                water_included=random.random() < 0.3,
                electricity_included=random.random() < 0.2,
                internet_included=random.random() < 0.15,
                security_included=random.random() < 0.25,
                amenities=faker.words(nb=4),
                photos=[],
                rent_amount=rent_amount,
                is_available=True,
                description=faker.sentence(),
            )
            properties.append(prop)

            if random.random() < 0.6:
                Listing.objects.create(
                    agency=agency,
                    property=prop,
                    title=f"Location {prop.title}",
                    description=faker.text(max_nb_chars=120),
                    public_address=prop.address,
                    city=prop.city,
                    price=rent_amount,
                    currency="XOF",
                    status=random.choice([ListingStatus.PUBLISHED, ListingStatus.DRAFT]),
                    published_at=timezone.now() - timedelta(days=random.randint(1, 60)),
                    available_from=timezone.localdate() + timedelta(days=random.randint(0, 30)),
                    contact_name=faker.name(),
                    contact_phone=self._fake_phone(faker),
                    contact_email=faker.unique.email(),
                    is_featured=random.random() < 0.2,
                )

        return properties

    def _create_tenants(self, faker, agency, count):
        tenants = []
        for _ in range(count):
            tenants.append(
                Tenant.objects.create(
                    agency=agency,
                    full_name=faker.name(),
                    phone_number=self._fake_phone(faker),
                    email=faker.unique.email(),
                    id_number=faker.unique.bothify(text="CI########"),
                    address=faker.address().replace("\n", ", "),
                    emergency_contact_name=faker.name(),
                    emergency_contact_phone=self._fake_phone(faker),
                    is_active=random.random() < 0.9,
                    notes=faker.sentence(),
                )
            )
        return tenants

    def _create_leases(self, faker, agency, properties, tenants, count):
        leases = []
        available_properties = properties[:]
        random.shuffle(available_properties)

        for _ in range(min(count, len(properties))):
            if not available_properties:
                break
            prop = available_properties.pop()
            tenant = random.choice(tenants)
            status = random.choices(
                [LeaseStatus.ACTIVE, LeaseStatus.ENDED, LeaseStatus.CANCELLED],
                weights=[0.65, 0.25, 0.1],
                k=1,
            )[0]

            start_date = timezone.localdate() - timedelta(days=random.randint(30, 720))
            end_date = None
            if status != LeaseStatus.ACTIVE:
                end_date = start_date + timedelta(days=random.randint(120, 540))
            lease = Lease.objects.create(
                agency=agency,
                property=prop,
                tenant=tenant,
                tenant_name=tenant.full_name,
                tenant_phone=tenant.phone_number,
                tenant_email=tenant.email,
                start_date=start_date,
                end_date=end_date,
                rent_amount=prop.rent_amount,
                deposit_amount=prop.rent_amount * random.randint(1, 2),
                status=status,
                notes=faker.sentence(),
            )
            if status == LeaseStatus.ACTIVE:
                prop.is_available = False
                prop.save(update_fields=["is_available"])
            leases.append(lease)

        return leases

    def _create_payments(self, faker, agency, leases, count):
        if not leases:
            return
        for _ in range(count):
            lease = random.choice(leases)
            status = random.choices(
                [PaymentStatus.PAID, PaymentStatus.PENDING, PaymentStatus.FAILED],
                weights=[0.75, 0.15, 0.1],
                k=1,
            )[0]
            paid_at = timezone.now() - timedelta(days=random.randint(1, 180))
            Payment.objects.create(
                agency=agency,
                lease=lease,
                amount=lease.rent_amount,
                status=status,
                paid_at=paid_at,
                reference=faker.unique.bothify(text="PAY-#####"),
                notes=faker.sentence(),
            )

    def _create_notifications(self, faker, agency, leases, count):
        if not leases:
            return
        created = 0
        attempts = 0
        max_attempts = count * 4
        while created < count and attempts < max_attempts:
            attempts += 1
            lease = random.choice(leases)
            status = random.choice(
                [NotificationStatus.PENDING, NotificationStatus.SENT, NotificationStatus.FAILED]
            )
            scheduled_for = timezone.localdate() - timedelta(days=random.randint(0, 30))
            channel = random.choice(
                [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.WHATSAPP]
            )
            template_key = random.choice(["rent_reminder", "payment_receipt", "welcome"])
            sent_at = (
                timezone.now() - timedelta(days=random.randint(0, 30))
                if status == NotificationStatus.SENT
                else None
            )
            obj, was_created = NotificationLog.objects.get_or_create(
                lease=lease,
                channel=channel,
                template_key=template_key,
                scheduled_for=scheduled_for,
                defaults={
                    "agency": agency,
                    "tenant": lease.tenant,
                    "status": status,
                    "message": faker.sentence(),
                    "error_message": "Erreur d'envoi." if status == NotificationStatus.FAILED else "",
                    "sent_at": sent_at,
                },
            )
            if was_created:
                created += 1
