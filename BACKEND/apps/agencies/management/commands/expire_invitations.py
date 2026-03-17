from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.agencies.models import AgencyInvitation, InvitationStatus


class Command(BaseCommand):
    help = "Mark expired agency invitations as expired."

    def handle(self, *args, **options):
        now = timezone.now()
        updated = AgencyInvitation.objects.filter(
            status=InvitationStatus.PENDING, expires_at__lte=now
        ).update(status=InvitationStatus.EXPIRED)
        self.stdout.write(self.style.SUCCESS(f"Expired invitations: {updated}"))
