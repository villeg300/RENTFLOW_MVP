# Debugging - RentFlow

Ce document regroupe les erreurs courantes et comment les diagnostiquer rapidement.

## 1) Auth / JWT
**Symptômes**
- `401 Unauthorized` sur `/api/v1/auth/users/me/`
- refresh token qui échoue (`/auth/jwt/refresh/`)

**Causes fréquentes**
- refresh token expiré ou supprimé
- utilisateur supprimé de la base

**Solutions**
- vider le `localStorage` du navigateur
- se reconnecter
- vérifier l’utilisateur dans l’admin

---

## 2) Erreur CORS / headers manquants
**Symptômes**
- requêtes bloquées dans la console
- `CORS` ou `blocked by CORS policy`

**À vérifier**
- `CORS_ALLOWED_ORIGINS` dans `BACKEND/.env`
- header `X-Agency-ID` bien présent

---

## 3) Relances / emails non envoyés
**Symptômes**
- aucun email malgré un POST réussi
- erreurs SMTP du type “Address not found”

**Causes**
- filtres trop restrictifs (`due_date`, `overdue_min_days`)
- SMTP non configuré

**Solutions**
- passer en mode console :
```
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```
- vérifier la sortie du serveur Django

---

## 4) Table “Relances à faire” vide
**Causes**
- aucun bail en retard
- le locataire a déjà été relancé aujourd’hui (anti‑spam)

**Astuce**
- vérifier les logs via :
```
GET /api/v1/notifications/logs/
```

---

## 5) Commandes utiles (debug)
```
python manage.py runserver 0.0.0.0:8000
python manage.py shell
python manage.py migrate
python manage.py send_rent_reminders
```

**Quand les utiliser**
- `runserver` : dev local
- `shell` : requêtes manuelles dans la DB
- `migrate` : après un pull
- `send_rent_reminders` : tester le flux de relance
