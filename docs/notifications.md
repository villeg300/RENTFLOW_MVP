# Notifications (SMS, WhatsApp, Email) - Guide de configuration

Ce document explique comment configurer et tester les notifications RentFlow
(SMS/WhatsApp/Email), y compris le setup Africa's Talking (AT).

## 1) Variables d'environnement

Fichier: `BACKEND/.env` (voir aussi `BACKEND/.env.example`)

```env
# Providers
SMS_PROVIDER=africastalking
WHATSAPP_PROVIDER=africastalking

# Simulation locale (pas d'envoi reel)
SMS_SIMULATE=true
WHATSAPP_SIMULATE=true

# Africa's Talking
AFRICASTALKING_USERNAME=
AFRICASTALKING_API_KEY=
AFRICASTALKING_SENDER_ID=
AFRICASTALKING_WHATSAPP_NUMBER=

# WhatsApp templates (optionnel)
WHATSAPP_USE_TEMPLATE=true
WHATSAPP_TEMPLATE_NAME=rent_reminder
WHATSAPP_TEMPLATE_LANGUAGE=fr
WHATSAPP_TEMPLATE_CATEGORY=UTILITY

# Regles de relance
NOTIFICATION_CHANNELS=email,sms,whatsapp
RENT_REMINDER_DAYS=-3,0,3
WHATSAPP_VERIFY_TTL_MINUTES=10
```

## 2) Configuration Africa's Talking (AT)

### 2.1 Creer un compte AT
1. Cree un compte sur Africa's Talking.
2. Accede au dashboard et cree une application.

### 2.2 Sandbox (SMS)
La sandbox sert a tester les SMS/USSD/Voice sans depenser de credit.
- Le username est souvent `sandbox` en mode test.
- L'API key est celle de l'app sandbox.

### 2.3 Production (SMS/WhatsApp)
En production, utilise les identifiants de l'app de production:
- `AFRICASTALKING_USERNAME` = nom du compte/app
- `AFRICASTALKING_API_KEY` = cle generee dans le dashboard
- `AFRICASTALKING_SENDER_ID` = sender ID (si approuve)
- `AFRICASTALKING_WHATSAPP_NUMBER` = numero WhatsApp approuve

### 2.4 WhatsApp via AT
Pour WhatsApp, il faut generalement:
- Un numero WhatsApp approuve
- Des templates approuves (utility, marketing, etc.)

En developpement, tu peux forcer `WHATSAPP_SIMULATE=true` pour eviter un envoi reel.

## 3) Endpoints principaux (API)

### 3.1 Logs des notifications
```
GET /api/v1/notifications/logs/
Authorization: Bearer <access>
```

Filtres possibles:
- `channel=email|sms|whatsapp`
- `status=sent|failed|simulated|skipped`
- `event=rent_reminder|receipt|whatsapp_verification`
- `tenant_id=<uuid>`

### 3.2 Dashboard notifications
```
GET /api/v1/notifications/dashboard/?days=30
Authorization: Bearer <access>
```
Retourne les totaux par statut et par canal.

### 3.3 Relance manuelle d'un bail
```
POST /api/v1/leases/<lease_id>/remind/
Authorization: Bearer <access>
```

### 3.4 Relance en masse (bulk)
```
POST /api/v1/notifications/reminders/bulk/
Authorization: Bearer <access>
{
  "channels": ["email", "sms", "whatsapp"],
  "message": "Bonjour {tenant_name}, votre loyer de {rent_amount} est du.",
  "overdue_min_days": 1,
  "overdue_max_days": 30,
  "only_overdue": true
}
```

## 4) Verification WhatsApp (locataire)

### 4.1 Envoyer un code
```
POST /api/v1/tenants/<tenant_id>/whatsapp/verify/
Authorization: Bearer <access>
```

### 4.2 Confirmer le code
```
POST /api/v1/tenants/<tenant_id>/whatsapp/confirm/
Authorization: Bearer <access>
{
  "code": "123456"
}
```

## 5) Conseils de test

- Commence avec `SMS_SIMULATE=true` et `WHATSAPP_SIMULATE=true`.
- Une fois les identifiants AT disponibles, mets `SMS_SIMULATE=false`
  pour tester les SMS reels.
- Garde `WHATSAPP_SIMULATE=true` tant que le numero WhatsApp n'est pas approuve.

## 6) Points a verifier avant prod

- Activation des templates WhatsApp.
- Sender ID SMS valide.
- Email SMTP fiable (pas Gmail perso en prod).
- Rotation des tokens et throttling actifs.

## 7) Runbook (Ops)

Commandes utiles:
1. Envoyer les rappels automatiquement
```
python manage.py send_rent_reminders
```

2. Relance manuelle d'un bail
```
POST /api/v1/leases/<lease_id>/remind/
Authorization: Bearer <access>
```

3. Relance en masse
```
POST /api/v1/notifications/reminders/bulk/
Authorization: Bearer <access>
```

4. Verifier les logs
```
GET /api/v1/notifications/logs/
Authorization: Bearer <access>
```

5. Dashboards notifications
```
GET /api/v1/notifications/dashboard/?days=30
Authorization: Bearer <access>
```

Bonnes pratiques:
1. Lancer `send_rent_reminders` via cron/Celery (ex: tous les jours a 08h).
2. Garder `SMS_SIMULATE`/`WHATSAPP_SIMULATE` a `true` en dev.
3. Activer des alertes sur les erreurs d'envoi (logs `failed`).
