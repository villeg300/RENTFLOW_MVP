from rest_framework.permissions import BasePermission

from .models import Agency, AgencyMembership, AgencyRole


def resolve_agency(request, agency_id=None):
    if agency_id:
        agency = Agency.objects.filter(id=agency_id).first()
        if agency:
            return agency

    header_id = request.headers.get("X-Agency-ID") or request.headers.get("X-Org-ID")
    query_id = None
    if hasattr(request, "query_params"):
        query_id = request.query_params.get("agency") or request.query_params.get(
            "agency_id"
        )
    data_id = None
    if hasattr(request, "data"):
        data_id = request.data.get("agency") or request.data.get("agency_id")

    token_id = None
    auth_token = getattr(request, "auth", None)
    if auth_token and hasattr(auth_token, "get"):
        token_id = auth_token.get("agency_id")

    agency_id = header_id or query_id or data_id or token_id
    if not agency_id:
        return None
    return Agency.objects.filter(id=agency_id).first()


class IsAgencyMember(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        agency_id = None
        if hasattr(view, "kwargs"):
            agency_id = view.kwargs.get("agency_id") or view.kwargs.get("pk")
        agency = resolve_agency(request, agency_id=agency_id)
        if not agency:
            return False
        request.agency = agency
        return AgencyMembership.objects.filter(
            agency=agency, user=request.user, is_active=True
        ).exists()


class HasAgencyRole(BasePermission):
    allowed_roles = []

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        agency_id = None
        if hasattr(view, "kwargs"):
            agency_id = view.kwargs.get("agency_id") or view.kwargs.get("pk")
        agency = resolve_agency(request, agency_id=agency_id)
        if not agency:
            return False
        request.agency = agency
        return AgencyMembership.objects.filter(
            agency=agency,
            user=request.user,
            role__in=self.allowed_roles,
            is_active=True,
        ).exists()


class IsAgencyOwner(HasAgencyRole):
    allowed_roles = [AgencyRole.OWNER]


class IsAgencyOwnerOrManager(HasAgencyRole):
    allowed_roles = [AgencyRole.OWNER, AgencyRole.MANAGER]


class IsAgencyOperator(HasAgencyRole):
    allowed_roles = [AgencyRole.OWNER, AgencyRole.MANAGER, AgencyRole.AGENT]
