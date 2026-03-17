import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class Agency(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    email = models.EmailField(blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="agencies_created",
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Agency"
        verbose_name_plural = "Agencies"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name) or str(self.id)
            slug = base_slug
            counter = 1
            while Agency.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class AgencyRole(models.TextChoices):
    OWNER = "owner", "Owner"
    MANAGER = "manager", "Manager"
    AGENT = "agent", "Agent"
    VIEWER = "viewer", "Viewer"


class AgencyMembership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    agency = models.ForeignKey(
        Agency, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(
        max_length=20, choices=AgencyRole.choices, default=AgencyRole.AGENT
    )
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ("agency", "user")
        ordering = ["-joined_at"]
        verbose_name = "Agency member"
        verbose_name_plural = "Agency members"

    def __str__(self):
        return f"{self.user} -> {self.agency} ({self.role})"


class InvitationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    REVOKED = "revoked", "Revoked"
    EXPIRED = "expired", "Expired"


def _default_invite_expiry():
    return timezone.now() + timedelta(days=7)


class AgencyInvitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    agency = models.ForeignKey(
        Agency, on_delete=models.CASCADE, related_name="invitations"
    )
    email = models.EmailField()
    role = models.CharField(
        max_length=20, choices=AgencyRole.choices, default=AgencyRole.AGENT
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="agency_invitations_sent",
    )
    accepted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="agency_invitations_accepted",
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=20, choices=InvitationStatus.choices, default=InvitationStatus.PENDING
    )
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(default=_default_invite_expiry)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Agency invitation"
        verbose_name_plural = "Agency invitations"

    @property
    def is_expired(self):
        return self.expires_at and self.expires_at <= timezone.now()

    def mark_expired(self):
        if self.status == InvitationStatus.PENDING and self.is_expired:
            self.status = InvitationStatus.EXPIRED
            self.save(update_fields=["status"])

    def __str__(self):
        return f"{self.email} -> {self.agency} ({self.status})"
