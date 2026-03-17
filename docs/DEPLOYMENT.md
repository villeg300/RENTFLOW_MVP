# Deploiement (Backend RentFlow)

Ce document est un guide rapide pour mettre en production le backend.

## 1) Pre-requis
1. Serveur Linux (Ubuntu 22.04+ recommande).
2. Python 3.12+.
3. PostgreSQL 16+.
4. Redis (si usage Celery).
5. Nom de domaine + DNS.
6. Certificats TLS (LetsEncrypt).

## 2) Variables d'environnement
Fichier: `BACKEND/.env`

Checklist:
1. `DEBUG=False`
2. `SECRET_KEY` unique et secret
3. `ALLOWED_HOSTS` = domaine prod
4. `DATABASE_*` vers PostgreSQL prod
5. SMTP pro (SendGrid, Mailgun, Postmark, etc.)
6. `AFRICASTALKING_*` pour SMS/WhatsApp
7. `CINETPAY_*` pour paiements SaaS
8. `FRONTEND_DOMAIN` vers domaine web

Note: `CINETPAY_NOTIFY_URL` doit etre une URL publique (pas de localhost).

## 3) Base de donnees
1. Creer l'utilisateur + la DB.
2. Appliquer les migrations:
```
python manage.py migrate
```

## 4) Static & Media
1. Definir `STATIC_ROOT` et `MEDIA_ROOT` en prod.
2. Lancer:
```
python manage.py collectstatic
```
3. Servir `static/` et `media/` via Nginx ou un storage externe (S3/Cloudflare R2).

## 5) WSGI / ASGI
Recommande: Gunicorn pour WSGI.
Exemple:
```
gunicorn core.wsgi:application --bind 0.0.0.0:8000 --workers 3
```

Si tu utilises un ASGI server (Daphne/Uvicorn), adapte le fichier d'entree.

## 6) Reverse proxy
Nginx:
1. Terminer TLS.
2. Proxy vers Gunicorn/Uvicorn.
3. Servir static/media.

## 7) Celery (optionnel)
Si tu ajoutes des taches (notifications, factures, cron):
1. Redis comme broker.
2. Lancer un worker + beat:
```
celery -A core worker -l info
celery -A core beat -l info
```
3. Les schedules sont geres via `django-celery-beat` (DB).
   - `send_rent_reminders` tous les jours a 08h.
   - `expire_trials` tous les jours a 01h.
4. Initialise les taches si besoin:
```
python manage.py setup_periodic_tasks
```

## 11) Ops alertes
Pour recevoir un email si une tache echoue:
1. Configurer `OPS_ALERTS_ENABLED=true`
2. Definir `OPS_ALERTS_EMAILS=ops@example.com,owner@example.com`

## 8) Observabilite
1. Activer logs estructures.
2. Mettre un Sentry ou equivalent.
3. Monitoring DB (latence, connexions).

## 9) Sauvegardes
1. Dump PostgreSQL quotidien.
2. Retention 7-30 jours.
3. Stockage externe securise.

## 10) Check final avant go-live
1. `DEBUG=False`
2. SMTP prod ok
3. SMS/WhatsApp prod ok
4. CinetPay prod ok (site_id, api_key, webhook public)
5. Superuser cree
6. Tests passes
