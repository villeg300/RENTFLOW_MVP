"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from apps.accounts.views import (
    ActivationView,
    CustomLogoutView,
    CustomTokenObtainPairView,
    LogoutAllView,
    ResetPasswordConfirmView,
    ResetPasswordView,
    activate_account_view,
    reset_password_view,
)
from apps.agencies.views import accept_invitation_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/<str:version>/', include('apps.agencies.urls')),
    path('api/<str:version>/', include('apps.properties.urls')),
    path('api/<str:version>/', include('apps.leases.urls')),
    path('api/<str:version>/', include('apps.payments.urls')),
    path('api/<str:version>/', include('apps.notifications.urls')),
    path('api/<str:version>/', include('apps.billing.urls')),
    path('api/<str:version>/', include('apps.ops.urls')),
    path('api/<str:version>/auth/jwt/create/', CustomTokenObtainPairView.as_view(), name='jwt_create'),
    path('api/<str:version>/auth/jwt/logout/', CustomLogoutView.as_view(), name='jwt_logout'),
    path('api/<str:version>/auth/jwt/logout_all/', LogoutAllView.as_view(), name='jwt_logout_all'),
    path('api/<str:version>/auth/users/reset_password/', ResetPasswordView.as_view(), name='user-reset-password'),
    path('api/<str:version>/auth/users/reset_password_confirm/', ResetPasswordConfirmView.as_view(), name='user-reset-password-confirm'),
    path('api/<str:version>/auth/users/activation/', ActivationView.as_view(), name='user-activation'),
    path('api/<str:version>/auth/', include('djoser.urls')),
    path('api/<str:version>/auth/', include('djoser.urls.jwt')),
    path('reset-password/', reset_password_view, name='reset_password'),
    path('activate/', activate_account_view, name='activate_account'),
    path('accept-invite/', accept_invitation_view, name='accept_invite'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
