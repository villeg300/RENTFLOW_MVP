from rest_framework import exceptions

from .models import AgencyMembership
from .permissions import resolve_agency


class AgencyScopedMixin:
    """
    Mixin pour filtrer automatiquement par agence active.
    Utilise l'en-tete X-Agency-ID (ou X-Org-ID) ou ?agency_id=.
    """

    def get_agency(self):
        agency = resolve_agency(self.request)
        if not agency:
            raise exceptions.ValidationError(
                {"agency": "Agence requise. Passez X-Agency-ID ou ?agency_id=."}
            )
        if not AgencyMembership.objects.filter(
            agency=agency, user=self.request.user, is_active=True
        ).exists():
            raise exceptions.PermissionDenied("Acces refuse a cette agence.")
        self.request.agency = agency
        return agency

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.filter(agency=self.get_agency())

    def perform_create(self, serializer):
        serializer.save(agency=self.get_agency())

    def get_serializer_context(self):
        context = super().get_serializer_context()
        try:
            agency = self.get_agency()
        except Exception:
            agency = None
        if agency:
            context["agency"] = agency
        return context
