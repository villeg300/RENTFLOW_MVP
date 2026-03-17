from django.contrib import admin

from .models import Agency, AgencyInvitation, AgencyMembership


@admin.register(Agency)
class AgencyAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "slug",
        "email",
        "phone_number",
        "is_active",
        "created_at",
    )
    search_fields = ("name", "slug", "email", "phone_number")
    list_filter = ("is_active", "created_at")


@admin.register(AgencyMembership)
class AgencyMembershipAdmin(admin.ModelAdmin):
    list_display = ("id", "agency", "user", "role", "is_active", "joined_at")
    search_fields = ("agency__name", "user__email", "user__phone_number")
    list_filter = ("role", "is_active", "joined_at")


@admin.register(AgencyInvitation)
class AgencyInvitationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "agency",
        "email",
        "role",
        "status",
        "invited_by",
        "created_at",
        "expires_at",
    )
    search_fields = ("email", "agency__name", "invited_by__email")
    list_filter = ("status", "role", "created_at")
