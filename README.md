# RentFlow - SaaS de gestion immobiliere

## Nom
RentFlow

## Description
RentFlow est une plateforme SaaS de gestion immobiliere ciblee pour les agences et proprietaires d'Afrique de l'Ouest.
Le produit centralise les biens, contrats, paiements et l'equipe dans une seule interface avec un modele multi-tenant.

## Solution
Une API REST versionnee avec authentification JWT et multi-tenant (agences).
Chaque agence dispose de son espace isole pour gerer ses biens, baux et paiements.

## Fonctionnalites principales
- Authentification complete (inscription, activation, login, refresh, logout, reset password).
- Multi-tenant via agences et roles (owner, manager, agent, viewer).
- Gestion des biens (properties).
- Gestion des immeubles (buildings) et des units.
- Gestion des pieces (rooms) pour decrire les chambres/douches/etc.
- Gestion des locataires (tenants).
- Gestion des baux (leases).
- Gestion des paiements (payments).
- Facturation SaaS (plans, abonnements, factures).
- Marketplace (listings) en preparation.
- Geolocalisation des biens (latitude/longitude).
- Invitations d'equipe par email + acceptation via lien.
- Journal d'audit minimal.
- Protections securite (throttling, axes, refresh rotation).

## Ce qui est deja implemente
- Modeles User, Agency, Membership, Invitations, Property, Room, Building, Listing, Tenant, Lease, Payment.
- Modeles Billing: Plan, Subscription, Invoice.
- Endpoints REST pour auth, agences, membres, invitations, biens, pieces, locataires, baux, paiements, billing.
- Acceptation d'invitation avec auto-inscription si email inexistant.
- Page HTML Django pour accepter une invitation via navigateur.
- Commande de maintenance pour expirer les invitations.
- Tests pytest pour auth, agences, multi-tenant, invitations, leases, payments, properties, billing.

## Ce qui manque (Roadmap MVP et V2)
- Gestion des locataires (Tenant) et relations avances.
- Marketplace publique (filtrage de base).
- Scoring locataire et analyses ROI.

## Architecture technique
- Backend: Django + Django REST Framework
- Auth: Djoser + SimpleJWT + django-axes
- DB: PostgreSQL
- Queue/Tasks (prevu): Celery + Redis
- Frontend (prevu): Next.js
- Mobile (prevu): Flutter

## Notifications (SMS/WhatsApp)
Configuration dans `BACKEND/.env` ou `BACKEND/.env.example`:
- `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_SENDER_ID`, `AFRICASTALKING_WHATSAPP_NUMBER`
- `SMS_PROVIDER=africastalking` et `WHATSAPP_PROVIDER=africastalking`
- `SMS_SIMULATE=true` et `WHATSAPP_SIMULATE=true` pour tester localement sans envoi reel
- Templates WhatsApp: `WHATSAPP_USE_TEMPLATE`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE`, `WHATSAPP_TEMPLATE_CATEGORY`
- Canaux et relances: `NOTIFICATION_CHANNELS`, `RENT_REMINDER_DAYS`

## Versioning API
Toutes les routes API sont versionnees:
- Base: `/api/v1/`

## Multi-tenant
Deux options pour selectionner l'agence active:
- En-tete HTTP: `X-Agency-ID: <uuid>`
- Claim JWT: `agency_id` (si login fait avec `agency_id`)

## Endpoints et formats

### Authentification
1. Inscription
```
POST /api/v1/auth/users/
{
  "phone_number": "0700000000",
  "full_name": "Awa Traore",
  "email": "awa@example.com",
  "password": "S3cretPass#123",
  "re_password": "S3cretPass#123"
}
```
Response (201):
```
{
  "id": "...",
  "phone_number": "0700000000",
  "email": "awa@example.com",
  "full_name": "Awa Traore"
}
```

2. Activation
```
POST /api/v1/auth/users/activation/
{
  "uid": "<uid>",
  "token": "<token>"
}
```
Response: `204`

3. Login (email ou phone)
```
POST /api/v1/auth/jwt/create/
{
  "login": "awa@example.com",
  "password": "S3cretPass#123",
  "agency_id": "<optional-agency-uuid>"
}
```
Response (200):
```
{
  "refresh": "<jwt>",
  "access": "<jwt>"
}
```

4. Refresh
```
POST /api/v1/auth/jwt/refresh/
{ "refresh": "<jwt>" }
```

5. Logout
```
POST /api/v1/auth/jwt/logout/
{ "refresh": "<jwt>" }
```

6. Password reset
```
POST /api/v1/auth/users/reset_password/
{ "email": "awa@example.com" }
```

### Agences
1. Creer une agence
```
POST /api/v1/agencies/
Authorization: Bearer <access>
{
  "name": "Agence Alpha",
  "email": "contact@alpha.com",
  "phone_number": "70000000",
  "address": "Ouagadougou"
}
```
Response (201): agence + `role` = `owner`.

2. Lister les agences
```
GET /api/v1/agencies/
Authorization: Bearer <access>
```

### Membres
1. Ajouter un membre
```
POST /api/v1/agencies/<agency_id>/members/
Authorization: Bearer <access>
{
  "user_id": "<uuid>",
  "role": "manager"
}
```

### Invitations
1. Inviter un membre
```
POST /api/v1/agencies/<agency_id>/invitations/
Authorization: Bearer <access>
{
  "email": "invite@example.com",
  "role": "agent",
  "message": "Bienvenue"
}
```

2. Relancer une invitation
```
POST /api/v1/agencies/<agency_id>/invitations/<invitation_id>/resend/
Authorization: Bearer <access>
```

3. Revoquer une invitation
```
POST /api/v1/agencies/<agency_id>/invitations/<invitation_id>/revoke/
Authorization: Bearer <access>
```

4. Voir une invitation (public)
```
GET /api/v1/agencies/invitations/<token>/
```

5. Accepter une invitation (auth)
```
POST /api/v1/agencies/invitations/accept/
Authorization: Bearer <access>
{ "token": "<token>" }
```

6. Accepter une invitation (auto inscription)
```
POST /api/v1/agencies/invitations/accept/
{
  "token": "<token>",
  "full_name": "Nouvel Agent",
  "phone_number": "0700000099"
}
```

### Biens (Properties)
```
POST /api/v1/properties/
Authorization: Bearer <access>
X-Agency-ID: <uuid>
{
  "title": "Villa Moderne",
  "address": "Ouagadougou",
  "city": "Ouaga",
  "property_type": "house",
  "bedrooms": 3,
  "bathrooms": 2,
  "area_sqm": 120,
  "parking_spots": 1,
  "latitude": 12.3710,
  "longitude": -1.5197,
  "rent_amount": "300000",
  "is_available": true
}
```

### Pieces (Rooms)
```
POST /api/v1/rooms/
Authorization: Bearer <access>
X-Agency-ID: <uuid>
{
  "property": "<property_uuid>",
  "name": "Chambre principale",
  "room_type": "bedroom",
  "floor_number": 1,
  "area_sqm": 18.5,
  "has_window": true
}
```

### Locataires (Tenants)
```
POST /api/v1/tenants/
Authorization: Bearer <access>
X-Agency-ID: <uuid>
{
  "full_name": "Awa Traore",
  "phone_number": "70112233",
  "email": "awa@example.com",
  "address": "Ouaga",
  "id_number": "CI-12345",
  "emergency_contact_name": "Maman Awa",
  "emergency_contact_phone": "70000000",
  "notes": "Locataire fiable"
}
```
Filtres supportes (query params):
- `q` (nom, email, telephone)
- `phone`, `email`
- `is_active` (`true`/`false`)
- `ordering` (ex: `full_name`, `-created_at`, `phone_number`)
Pagination: `page`, `page_size`

Chaque locataire renvoie `leases` (liste legere des baux lies).
La liste paginee renvoie `leases_count` au lieu de la liste des baux.

Historique locataire:
```
GET /api/v1/tenants/<tenant_id>/history/
Authorization: Bearer <access>
X-Agency-ID: <uuid>
```
Response:
```
{
  "tenant": {...},
  "leases": {
    "count": 12,
    "next": "...",
    "previous": null,
    "results": [...]
  },
  "payments": {
    "count": 24,
    "next": "...",
    "previous": null,
    "results": [...]
  }
}
```
Pagination params:
- `leases_page`, `leases_page_size`
- `payments_page`, `payments_page_size`

### Marketplace (public)
```
GET /api/v1/marketplace/listings/
```
Filtres supportes (query params):
- `city`, `min_price`, `max_price`
- `property_type`, `min_bedrooms`, `max_bedrooms`
- `min_bathrooms`, `max_bathrooms`
- `min_area`, `max_area`
- `furnished`, `has_parking`, `has_pool`, `is_featured`
- `lat_min`, `lat_max`, `lng_min`, `lng_max`
- `lat`, `lng`, `radius_km` (filtre par rayon)
- `q` (recherche sur titre/description)

Note: si le filtre par rayon est utilise, la reponse publique ajoute `distance_km`.

### Dashboard financier
```
GET /api/v1/dashboard/finance/
Authorization: Bearer <access>
X-Agency-ID: <uuid>
```
Params optionnels:
- `start_date=YYYY-MM-DD`
- `end_date=YYYY-MM-DD`

Export CSV:
```
GET /api/v1/dashboard/finance/export/
Authorization: Bearer <access>
X-Agency-ID: <uuid>
```
Response (exemple):
```

### Quittances PDF
Telecharger une quittance:
```
GET /api/v1/payments/<payment_id>/receipt/
Authorization: Bearer <access>
X-Agency-ID: <uuid>
```

Envoyer la quittance par email:
```
POST /api/v1/payments/<payment_id>/receipt/send/
Authorization: Bearer <access>
X-Agency-ID: <uuid>
```
Envoi automatique (si active):
```
PAYMENT_AUTO_SEND_RECEIPT=true
```

### SMS (simulation + future prod Africa's Talking)
Un service SMS est disponible dans `apps.notifications.services.sms`.
Par defaut, `SMS_SIMULATE=True` pour simuler l'envoi.
Variables env:
- `SMS_PROVIDER=africastalking`
- `SMS_SIMULATE=true|false`
- `AFRICASTALKING_USERNAME`
- `AFRICASTALKING_API_KEY`
- `AFRICASTALKING_SENDER_ID` (optionnel)

### Services notifications
- Email: `apps.notifications.services.email.EmailService`
- WhatsApp: `apps.notifications.services.whatsapp.WhatsAppService` (simulate par defaut)
- Provider: Africa's Talking via SDK (`africastalking.Whatsapp.send`)
- Env requis: `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_WHATSAPP_NUMBER`
- Templates: `WHATSAPP_USE_TEMPLATE=true` + `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANGUAGE`, `WHATSAPP_TEMPLATE_CATEGORY`
- Verification: `WHATSAPP_VERIFY_TTL_MINUTES` (ex: 10)

### Notifications automatiques (rappels de loyers)
Commande:
```
python manage.py send_rent_reminders
```
Config:
- `NOTIFICATION_CHANNELS=email,sms,whatsapp`
- `RENT_REMINDER_DAYS=-3,0,3,7,15`
- `WHATSAPP_PROVIDER`, `WHATSAPP_SIMULATE`

Templates email:
- `templates/email/rent_reminder.txt`
- `templates/email/rent_reminder.html`

Logs notifications:
```
GET /api/v1/notifications/logs/
Authorization: Bearer <access>
X-Agency-ID: <uuid>
```
Filtres:
- `status`, `channel`, `template_key`
- `lease_id`, `tenant_id`
- `date_from`, `date_to` (YYYY-MM-DD)

Dashboard notifications:
```
GET /api/v1/notifications/dashboard/
Authorization: Bearer <access>
X-Agency-ID: <uuid>
```

Rappels en masse:
```
POST /api/v1/notifications/reminders/bulk/
Authorization: Bearer <access>
X-Agency-ID: <uuid>
{
  "channels": ["sms", "whatsapp"],
  "message": "Rappel: loyer de {amount} XOF pour {property_title} du {due_date}.",
  "due_date": "2026-03-01",
  "overdue_min_days": 3,
  "overdue_max_days": 15,
  "only_overdue": true
}
```
Placeholders message: `{amount}`, `{property_title}`, `{due_date}`, `{tenant_name}`, `{overdue_days}`.

Preferences par locataire:
```
GET /api/v1/tenants/<tenant_id>/preferences/
PATCH /api/v1/tenants/<tenant_id>/preferences/
```
Payload exemple:
```
{
  "allow_email": true,
  "allow_sms": false,
  "allow_whatsapp": true,
  "remind_days": "-5,0,5"
}
```

Verification WhatsApp:
```
POST /api/v1/tenants/<tenant_id>/whatsapp/verify/
POST /api/v1/tenants/<tenant_id>/whatsapp/confirm/
```
Payload confirm:
```
{ "code": "123456" }
```

Rappel manuel (par bail):
```
POST /api/v1/leases/<lease_id>/remind/
Authorization: Bearer <access>
X-Agency-ID: <uuid>
{
  "channels": ["email", "sms", "whatsapp"],
  "message": "Rappel: merci de regler le loyer."
}
```
POST /api/v1/payments/<payment_id>/receipt/send/
Authorization: Bearer <access>
X-Agency-ID: <uuid>
```
{
  "currency": "XOF",
  "period": {
    "start_date": "2026-03-01",
    "end_date": "2026-03-31",
    "is_custom": false
  },
  "revenues": {
    "current_month": 350000,
    "year_to_date": 1200000,
    "last_6_months": [
      {"month": "2025-10", "revenue": 0},
      {"month": "2025-11", "revenue": 150000},
      {"month": "2025-12", "revenue": 200000},
      {"month": "2026-01", "revenue": 300000},
      {"month": "2026-02", "revenue": 200000},
      {"month": "2026-03", "revenue": 350000}
    ]
  },
  "rent": {
    "expected_current_month": 500000,
    "collected_current_month": 350000,
    "outstanding_current_month": 150000
  },
  "occupancy": {
    "total_properties": 10,
    "occupied_properties": 7,
    "vacant_properties": 3,
    "rate_percent": 70.0
  },
  "leases": {
    "active_count": 7
  }
}
```

7. Accepter via navigateur (HTML)
```
GET /accept-invite/?token=<token>
```

### Properties (Biens)
```
POST /api/v1/properties/
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
{
  "title": "Villa A",
  "address": "Ouaga",
  "city": "Ouaga",
  "property_type": "house",
  "rent_amount": "250000",
  "is_available": true
}
```

```
GET /api/v1/properties/
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
```

### Buildings (Immeubles)
```
POST /api/v1/buildings/
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
{
  "name": "Immeuble A",
  "address": "Ouaga",
  "city": "Ouaga",
  "total_floors": 4,
  "total_units": 12,
  "amenities": ["ascenseur", "gardien"]
}
```

### Listings (Marketplace interne)
```
POST /api/v1/listings/
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
{
  "property": "<property_id>",
  "title": "Appartement 2 chambres",
  "price": "200000",
  "currency": "XOF",
  "status": "published"
}
```

### Marketplace publique
```
GET /api/v1/marketplace/listings/
```

### Leases (Baux)
```
POST /api/v1/leases/
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
{
  "property": "<property_id>",
  "tenant_name": "Abdou",
  "tenant_phone": "70112233",
  "tenant_email": "abdou@example.com",
  "start_date": "2026-04-01",
  "rent_amount": "250000",
  "deposit_amount": "250000"
}
```

Export CSV (baux):
```
GET /api/v1/leases/export/?start_date=2026-01-01&end_date=2026-01-31&status=active
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
```

### Tenants (Locataires)
Export CSV (locataires):
```
GET /api/v1/tenants/export/?is_active=true
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
```

### Payments (Paiements)
```
POST /api/v1/payments/
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
{
  "lease": "<lease_id>",
  "amount": "250000",
  "status": "paid",
  "reference": "CASH-001"
}
```

Export CSV (paiements):
```
GET /api/v1/payments/export/?start_date=2026-01-01&end_date=2026-01-31&status=paid
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
```

### Dashboard financier
```
GET /api/v1/dashboard/finance/
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
```

Export CSV (dashboard):
```
GET /api/v1/dashboard/finance/export/?start_date=2026-01-01&end_date=2026-01-31
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
```

### Billing (Plans / Abonnements / Factures)
Plans publics:
```
GET /api/v1/billing/plans/
```

Souscrire a un plan:
```
POST /api/v1/billing/subscription/
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
{
  "plan_id": "<plan_id>",
  "billing_cycle": "monthly"
}
```

Lister les factures:
```
GET /api/v1/billing/invoices/
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
```

PDF facture:
```
GET /api/v1/billing/invoices/<invoice_id>/pdf/
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
```

Payer une facture (CinetPay):
```
POST /api/v1/billing/invoices/<invoice_id>/checkout/
Authorization: Bearer <access>
X-Agency-ID: <agency_id>
{
  "customer_email": "owner@example.com",
  "customer_phone": "70000000"
}
```

Webhook CinetPay:
```
POST /api/v1/billing/cinetpay/webhook/
```

### Ops (Tasks)
Etat des taches planifiees:
```
GET /api/v1/ops/tasks/?page=1&page_size=50&failed=true
Authorization: Bearer <access>
```

## Flows principaux
**Onboarding standard**
1. Inscription utilisateur
2. Activation email
3. Login JWT
4. Creation d'agence
5. Gestion des biens

**Invitation d'equipe**
1. Owner/Manager envoie une invitation
2. Email recu avec lien d'acceptation
3. Acceptation via API ou page HTML
4. Membership cree automatiquement

**Cycle immobilier**
1. Creer un bien
2. Creer un bail
3. Enregistrer les paiements

## Commandes utiles
```
python manage.py expire_invitations
python manage.py expire_trials
python manage.py setup_periodic_tasks
```

## Tests
```
pytest
```

## Notes securite
- Refresh token rotation active.
- Throttling actif (scope login, activation, reset password).
- Axes contre brute-force.
- JWT contient `agency_id` si fourni a la connexion.
