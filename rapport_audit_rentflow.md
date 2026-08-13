# Rapport d'audit technique — RentFlow

Date d'audit : 2026-08-13
Auteur : Assistant IA (Copilot CLI runtime en VS Code)

> Ce document reprend l'audit complet produit et ajoute un plan d'action priorisé pour la reprise du projet.

---

## Sommaire exécutif

Le projet RentFlow est avancé côté backend : l'API couvre l'authentification multi-tenant, agences, biens, baux, paiements, facturation, notifications et dispose d'un important jeu de tests unitaires. Le frontend Next.js propose un dashboard fonctionnel (auth, biens, agences, analytics, notifications), mais plusieurs pages métier (contrats, paiements, quittances, locataires détaillés, rapports) sont incomplètes ou mockées. Le mobile (Flutter) est absent du dépôt. L'infrastructure de déploiement est incomplète : `docker-compose.yml` ne définit que Postgres et il manque Dockerfile/service pour backend, frontend, redis et workers Celery, empêchant un déploiement reproductible.

Actions prioritaires : corriger le bug critique dans le manager d'utilisateurs ([BACKEND/apps/accounts/models.py](/home/moyenga/dev/RENTFLOW/BACKEND/apps/accounts/models.py)), harmoniser la stratégie d'authentification côté frontend (stockage tokens), et fournir Dockerfiles + docker-compose complet.

---

## 1. État global du projet

- Niveau d'avancement estimé : **78%**

| Module | Statut | % estimé | Fichiers / remarques |
|---|---:|---:|---|
| Backend (API : auth, agences, biens, baux, paiements, billing, notifications, ops) | Terminé / mature | 90% | [BACKEND/apps/](/home/moyenga/dev/RENTFLOW/BACKEND/apps/) — tests nombreux |
| Frontend (Next.js dashboard) | Partiel | 65% | [FRONTEND/rent-flow/src/](/home/moyenga/dev/RENTFLOW/FRONTEND/rent-flow/src/) — plusieurs pages métier manquantes |
| Mobile (Flutter) | Absent | 0% | non trouvé dans le dépôt (docs indiquent Flutter) |
| Docker & déploiement | Partiel (DB only) | 25% | [BACKEND/docker-compose.yml](/home/moyenga/dev/RENTFLOW/BACKEND/docker-compose.yml) — manque backend/frontend/redis/worker |
| CI/CD | Non trouvé | 0% | pas de workflows visibles |
| Tests | Backend : oui, Frontend : non | backend 70% | tests backend présents dans [BACKEND/apps/*/tests.py](/home/moyenga/dev/RENTFLOW/BACKEND/apps/) |

Fonctionnalités visibles côté code : authentification (Djoser + JWT), multi-tenant (agences), properties/buildings/rooms/listings, tenants/leases, payments + receipts PDF, notifications (email/sms/whatsapp simulated), billing (plans/subscriptions/invoices), ops (tasks, seed_data).

---

## 2. Architecture actuelle

### Arborescence racine (extraits)
- /BACKEND : projet Django (core + apps), [docker-compose.yml](/home/moyenga/dev/RENTFLOW/BACKEND/docker-compose.yml), [.env.example](/home/moyenga/dev/RENTFLOW/BACKEND/.env.example)
- /FRONTEND/rent-flow : application Next.js (App Router, TypeScript, Tailwind)
- /docs : documentation (etat_projet.md, DEPLOYMENT.md, notifications.md...)

### Apps Django présentes
- apps.accounts, apps.agencies, apps.leases, apps.payments, apps.properties, apps.notifications, apps.billing, apps.ops (listées dans [BACKEND/core/settings.py](/home/moyenga/dev/RENTFLOW/BACKEND/core/settings.py)).

### Principales routes API
- /api/v1/auth/... (Djoser + JWT customizations — [BACKEND/core/urls.py](/home/moyenga/dev/RENTFLOW/BACKEND/core/urls.py))
- /api/v1/agencies/, /api/v1/properties/, /api/v1/leases/, /api/v1/payments/, /api/v1/notifications/, /api/v1/billing/, /api/v1/ops/
- Pages HTML Django : /reset-password/, /activate/, /accept-invite/

### Pages frontend existantes
- Auth : [src/app/auth/](/home/moyenga/dev/RENTFLOW/FRONTEND/rent-flow/src/app/auth)
- Dashboard : [src/app/dashboard/](/home/moyenga/dev/RENTFLOW/FRONTEND/rent-flow/src/app/dashboard) (activities, agences, alerts, analytics, biens, contrats (placeholder), locataires (partiel), notifications, paiements, quittances, reports)
- Landing / : [FRONTEND/rent-flow/src/app/page.tsx](/home/moyenga/dev/RENTFLOW/FRONTEND/rent-flow/src/app/page.tsx) (actuellement template à remplacer)

### Écrans Flutter
- non trouvé dans le dépôt — mobile non commencé.

### Services Docker
- [BACKEND/docker-compose.yml](/home/moyenga/dev/RENTFLOW/BACKEND/docker-compose.yml) contient seulement le service `db` (postgres:16). Pas de services backend, redis, worker, frontend.

### Dépendances majeures
- Backend : Django 6, djangorestframework, djoser, rest_framework_simplejwt, django-axes, django-celery-beat, celery, redis (config), ReportLab, africastalking, CinetPay (services). Voir [BACKEND/requirements.txt](/home/moyenga/dev/RENTFLOW/BACKEND/requirements.txt).
- Frontend : Next 16, React 19, TypeScript, TailwindCSS 4, shadcn/Radix, axios.

### Incohérences d'architecture
- docker-compose ne suffit pas pour lancer l'app complète.
- Mobile mentionné mais absent.
- Frontend et backend token storage incohérence (commentaires et code divergents).

---

## 3. Backend (audit détaillé)

### Modèles
- Correct : modèles métiers exhaustifs (Agency, Property, Building, Room, Listing, Tenant, Lease, Payment, Plan, Subscription, Invoice, NotificationLog, AuditLog).
- À améliorer : ajouter indexes pour colonnes fréquemment filtrées (agency_id, property_id, lease_id, created_at). Ajouter champs audit (created_by/updated_by) là où utile.

### Migrations
- Dossiers `migrations` présents par app. Pas d'erreur visible sans exécution.

### Serializers
- Bon niveau de validations (belongs-to-agency checks). Recommander factorisation des validations communes.
- Exemple : [BACKEND/apps/properties/serializers.py](/home/moyenga/dev/RENTFLOW/BACKEND/apps/properties/serializers.py)

### Vues / Viewsets
- Utilisation correcte de viewsets, permissions agence. Exemple : [BACKEND/apps/properties/views.py](/home/moyenga/dev/RENTFLOW/BACKEND/apps/properties/views.py)
- Attention aux requêtes complexes (annotate ACos pour distance) : tester perf sur datasets réels.

### Permissions & Authentification
- Djoser configuré, SimpleJWT avec rotation & blacklist. Axes pour brute-force. Bon ensemble.
- Problème critique à corriger : _create_user_ bug dans [BACKEND/apps/accounts/models.py](/home/moyenga/dev/RENTFLOW/BACKEND/apps/accounts/models.py) : signature incorrecte/paramètres manquants (usage de variable `password` non définie). Ce blocera la création d'utilisateurs via manager (admin, scripts).

### Validation des données
- Présente, mais manque validation stricte pour uploads (taille/type).

### Gestion des erreurs
- Utilisation de DRF exceptions/ValidationError. Recommander normalisation centrale du format d'erreur.

### Tests
- Tests backend présents et nombreux (auth, agencies, properties, leases, payments, billing, notifications, ops). Très positif.

### Settings / config
- Usage de decouple, bonnes variables. Attention : [.env.example](/home/moyenga/dev/RENTFLOW/BACKEND/.env.example) a `DEBUG=True` par défaut (risque si utilisé en prod). Recommander CI check.

### Sécurité
- Points forts : throttling, axes, JWT rotation/blacklist.
- À durcir : HTTPS / SECURE_* settings pour prod, content security policy, cookie flags, validation upload, revue des logs pour éviter fuite de secrets.

### Problèmes détectés (exemples concrets)
- Bug critique : [BACKEND/apps/accounts/models.py] — create_user/create_superuser incorrects.
- Incohérence rapportée dans docs : `PropertyImageViewSet.get_queryset` retournant des objets erronés signalé dans docs — vérifié, dans le code actuel le viewset filtre `PropertyImage` (corriger si docs obsolètes). Fichier : [BACKEND/apps/properties/views.py](/home/moyenga/dev/RENTFLOW/BACKEND/apps/properties/views.py)

---

## 4. Frontend web

### Structure
- Next.js App Router, TypeScript, Tailwind, contexts (AuthContext, AgencyContext) — [FRONTEND/rent-flow/src/](/home/moyenga/dev/RENTFLOW/FRONTEND/rent-flow/src/)

### Routing & pages
- Dashboard complet (sous-pages), auth pages présentes. Page `/` est encore template Next.js et doit être remplacée.

### Gestion d'état
- AuthContext, AgencyContext (localStorage) ; axios interceptors pour refresh token présents.
- Incohérence : commentaire indique token en mémoire mais code persiste en localStorage — à harmoniser.

### Appels API
- Services axios centralisés. Bien branché pour la plupart des pages, certaines utilisent mocks (`data.json`).

### Composants, formulaires, UX
- UI basée sur shadcn/Radix, composants réutilisables ; bonnes pratiques Tailwind.

### Pages connectées vs mockées
- Connectées : login, agences, biens (liste & detail), dashboard analytics, notifications.
- Mockées / incomplètes : contrats, paiements, quittances, reports, locataires (partiel).

### Tests & qualité
- Pas de tests frontend visibles. Ajouter tests unitaires / intégration.

---

## 5. Application mobile Flutter

- Code mobile **non trouvé** dans le dépôt. Docs mentionnent Flutter mais aucun dossier `mobile`, pas de `pubspec.yaml`.
- Statut : Non commencé. Prioriser la création d'un projet Flutter si le mobile est requis.

---

## 6. Base de données

- Cohérence générale : FK et relations présentes.
- Recommandations :
  - Ajouter index sur colonnes filtrées (agency_id, property_id, lease.start_date, payment.status).
  - Ajouter contraintes uniques si nécessaire (invoice.reference).
  - Ajouter optionally soft-delete si besoin métier.
  - Normaliser champs monétaires (DecimalField avec scale/digits appropriés).

---

## 7. Docker et déploiement

- [BACKEND/docker-compose.yml](/home/moyenga/dev/RENTFLOW/BACKEND/docker-compose.yml) : ne définit que `db` (postgres). Pas de Dockerfile backend/frontend.
- Ce qui empêche le déploiement en l'état : absence de Dockerfiles et de services pour backend, redis et workers ; pas de reverse proxy/HTTPS ; scripts de migrations/collectstatic dans compose.

Recommandations immédiates : créer Dockerfile backend (python + gunicorn), Dockerfile frontend (next build & start or static export), ajouter services redis & worker, ajouter nginx/traefik pour HTTPS en prod.

---

## 8. Qualité du code

- Lisibilité : bonne.
- Organisation : apps découplés, tests backend.
- Conventions : majoritairement cohérentes.
- Typage TS : présent mais tests manquants.

Notes (sur 10) :
- Backend : 8.0/10
- Frontend : 6.5/10
- Mobile : 0/10
- Architecture globale : 6.5/10

---

## 9. Sécurité — résumé et classification des risques

- Secrets committés : **non trouvé** (seulement `.env.example` avec placeholders).
- DEBUG activé dans `.env.example` : **risque** (corriger / CI check).
- CORS & CSRF : middleware présents ; vérifier origines prod.
- JWT : rotation & blacklist activés.

Risques classés :
- Critique : bug create_user (fonctionnellement bloquant)
- Majeur : absence d'infra de déploiement complète (empêche prod)
- Majeur : stockage des tokens en localStorage (XSS risk)
- Mineur : uploads non validés, manque d'indexes

---

## 10. Fonctionnalités métier — état détaillé

| Module | Statut |
|---|---:|
| Immeubles | Terminé |
| Logements / Biens | Terminé |
| Propriétaires | Partiel |
| Locataires | Partiel |
| Baux | Terminé (backend), Frontend partiel |
| Loyers / Paiements | Terminé (backend), Frontend partiel |
| Paiements externes | Terminé (CinetPay backend) |
| Quittances | Terminé (PDF + envoi) |
| Charges | Partiel |
| Relances | Terminé (backend) |
| Maintenance | Partiel |
| Documents | Partiel |
| Rapports | Partiel |
| Notifications | Terminé |
| Abonnements SaaS | Terminé |
| Multi-tenant | Terminé |

---

## 11. Points à éclaircir

Liste des questions importantes non résolues par le dépôt :
1. Politique exacte de stockage des tokens côté frontend (préférence mémoire vs localStorage vs httpOnly cookie) ?
2. Règles métier détaillées pour calcul des charges et pénalités de retard ?
3. Politique de facturation (prorata, taxes, cycles) ?
4. Multi-tenant : séparation DB par tenant souhaitée ou modèle single DB + agence_id suffisant ?
5. Règles d'expiration / rétention des logs et backups souhaitées ?
6. Liste des PSP alternatifs à intégrer (si besoin) ?
7. Besoin réel d'une application mobile native ou la PWA / site responsive suffit ?

---

## 12. Priorités immédiates — Roadmap priorisée

### À faire aujourd’hui (1–2 h)
1. Corriger le bug critique `create_user` dans :
   - [BACKEND/apps/accounts/models.py](/home/moyenga/dev/RENTFLOW/BACKEND/apps/accounts/models.py)
   - Ajouter test unitaire minimal pour create_user/create_superuser et exécution rapide `pytest` ciblé.
2. Mettre `DEBUG=False` par défaut dans `.env.example` ou ajouter note CI pour bloquer push si DEBUG=True :
   - [BACKEND/.env.example](/home/moyenga/dev/RENTFLOW/BACKEND/.env.example)
3. Documenter immédiatement la politique de tokens côté frontend (decision short note) et blocker les changements dans le code frontend tant que la stratégie n'est pas fixée.

### À faire cette semaine
1. Ajouter Dockerfile backend & frontend et compléter `docker-compose` (services : db, redis, backend, worker, frontend, nginx) — test `docker-compose up`.
2. Harmoniser stockage tokens sur frontend : préférer httpOnly refresh cookie + access token en mémoire ou same-site cookie, corriger le code et ajouter test d'intégration.
3. Compléter pages frontend prioritaires : `/dashboard/contrats`, `/dashboard/paiements`, `/dashboard/quittances`, `/dashboard/locataires`.
4. Ajouter validations upload (size/type) pour PropertyImage.
5. Ajouter indexes DB recommandés (migration SQL / Django migrations).

### À faire ce mois-ci
1. Mettre en place CI/CD (tests backend, build frontend, lint, security checks) et pipeline de déploiement images.
2. Durcir settings production (SECURE_SSL_REDIRECT, cookie flags, CSP, HSTS).
3. Implémenter healthchecks, monitoring et alertes ops.
4. Ajouter tests E2E (auth flow, payments webhook).

### Avant mise en production
1. Finaliser infrastructure (images, secrets manager, TLS, load balancer).
2. Revue sécurité (pentest / code scan).
3. Backup & migration plan validé et testé.

---

## 13. Estimation du travail restant (jours/homme)
- Backend (corrections, hardening) : 12 j/h
- Frontend (terminer pages métier, tests) : 18 j/h
- Mobile (création projet Flutter + intégration) : 30 j/h
- Tests (E2E + coverage) : 10 j/h
- Déploiement (Dockerfiles, compose, CI/CD) : 12 j/h
- Documentation : 5 j/h

**Total approximatif : ~87 j/h**

---

## 14. Risques principaux (top 10) & actions
1. Bug create_user (impact critique) — corriger et tester immédiatement.
2. Infra/déploiement manquante — créer Dockerfiles + compose complet.
3. Token storage insecure — choisir httpOnly cookie et appliquer.
4. Redis/worker manquants — ajouter et tester Celery flows.
5. Uploads non limités — ajouter validations et quotas.
6. DEBUG en prod — CI check et policy.
7. Manque d'indexes — ajouter migrations.
8. Webhooks payments non testés — ajouter tests E2E.
9. Mobile absent — décider MVP mobile ou focus web.
10. Logs sensibles — sanitize et policy de rotation.

---

## 15. Résumé exécutif (5 actions prioritaires)
1. Corriger le bug `create_user` dans [BACKEND/apps/accounts/models.py](/home/moyenga/dev/RENTFLOW/BACKEND/apps/accounts/models.py) et ajouter des tests unitaires pour cover ce chemin critique.
2. Fournir Dockerfile backend & frontend et compléter `docker-compose.yml` pour inclure db, redis, backend, worker et frontend (permettre `docker-compose up` reproductible localement).
3. Harmoniser stratégie JWT/token côté frontend (préconisation : httpOnly refresh cookie + access en mémoire) et appliquer le changement.
4. Compléter pages frontend critiques : contrats, paiements, quittances, locataires (mise en prod de ces flows essentiels).
5. Durcir settings production (DEBUG=False, SECURE_*, cookie flags, CSP) et mettre en place CI qui bloque si settings dangereux.

---

### Plan d'action immédiat détaillé (checklist exécutable)

1) Correction critique (Aujourd'hui, 1–2 h)
   - Editeur : corriger `create_user` et `create_superuser` dans [BACKEND/apps/accounts/models.py](/home/moyenga/dev/RENTFLOW/BACKEND/apps/accounts/models.py).
   - Tests : ajouter test `tests/accounts/test_user_manager.py` (create_user & create_superuser) et lancer `pytest BACKEND/apps/accounts/tests -q`.

2) Infra locale reproducible (Cette semaine, 2–3 jours)
   - Créer `BACKEND/Dockerfile` (Python base, pip install -r requirements.txt, collectstatic, gunicorn).
   - Créer `FRONTEND/rent-flow/Dockerfile` (node build & start) ou static export.
   - Mettre à jour `BACKEND/docker-compose.yml` pour inclure `backend`, `redis`, `worker`, `frontend`, `nginx` (exemples en README/docs).
   - Tester `docker-compose up --build` et corriger erreurs.

3) Auth / tokens frontend (Cette semaine, 1–2 jours)
   - Décision produit : httpOnly refresh cookie + access token en mémoire (recommandé).
   - Implémentation : modifier axios interceptor & AuthContext (FRONTEND/rent-flow/src/) ; ajouter endpoint backend pour set-cookie du refresh.
   - Tests manuels et automatisés.

4) Compléter UI métier (2–3 semaines)
   - Priorité pages : contrats, paiements, quittances, locataires.
   - Écrire services frontend (hooks + services axios) et endpoints tests.
   - QA & tests manuels.

5) Sécurité & Prod hardening (1 semaine)
   - Paramètres prod checklist (SECURE_SSL_REDIRECT, SESSION_COOKIE_SECURE, CSRF_COOKIE_SECURE, HSTS, CSP).
   - CI check (lint, pytest, verify DEBUG=False), scans SAST.

---

## Fichiers cités (rappel)
- [BACKEND/core/settings.py](/home/moyenga/dev/RENTFLOW/BACKEND/core/settings.py)
- [BACKEND/apps/accounts/models.py](/home/moyenga/dev/RENTFLOW/BACKEND/apps/accounts/models.py)
- [BACKEND/apps/properties/serializers.py](/home/moyenga/dev/RENTFLOW/BACKEND/apps/properties/serializers.py)
- [BACKEND/apps/properties/views.py](/home/moyenga/dev/RENTFLOW/BACKEND/apps/properties/views.py)
- [BACKEND/docker-compose.yml](/home/moyenga/dev/RENTFLOW/BACKEND/docker-compose.yml)
- [BACKEND/.env.example](/home/moyenga/dev/RENTFLOW/BACKEND/.env.example)
- [FRONTEND/rent-flow/src/](/home/moyenga/dev/RENTFLOW/FRONTEND/rent-flow/src/)
- [docs/etat_projet.md](/home/moyenga/dev/RENTFLOW/docs/etat_projet.md)

---

Si vous le souhaitez, deux actions possibles maintenant :
- A : appliquer immédiatement la **correction critique** sur `create_user` et lancer les tests ciblés (je peux modifier le code et exécuter les tests si vous validez).
- B : générer les Dockerfiles d'exemple et un `docker-compose.yml` complet (dev) pour permettre `up` local rapide.

Quel choix priorisez-vous ?
