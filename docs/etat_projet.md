# Etat du projet RentFlow

Date d'audit : 21 mai 2026

## Perimetre lu

- [x] `BACKEND` : code Django/DRF, apps metier, migrations, tests, templates, commandes, configuration, clients REST et `.env` lu uniquement sous forme de cles masquees.
- [x] `FRONTEND/rent-flow` : app Next.js, routes, composants, hooks, services API, types, config, assets publics, `.env` lu uniquement sous forme de cles masquees.
- [x] `docs` : guides existants de debug, notifications, reset DB, UI/UX et deploiement.
- [x] Exclusions raisonnables : valeurs secretes, caches, environnements virtuels, `node_modules`, `.next`, fichiers binaires/media non analysables ligne par ligne.

## Resume executif

RentFlow est deja bien avance cote backend : l'API couvre l'authentification, le multi-tenant par agences, les biens, immeubles, pieces, locataires, baux, paiements, quittances PDF, notifications email/SMS/WhatsApp, facturation SaaS et quelques outils ops. Le backend dispose aussi d'une base de tests importante.

Cote frontend, l'authentification, le dashboard, les agences, les biens, les immeubles, l'analytics, les alertes, les activites et les notifications sont partiellement ou fortement branches sur l'API. En revanche, plusieurs parcours metier majeurs restent sous forme de placeholder ou sont incomplets : contrats, locataires, paiements, quittances, reports, invitations equipe, facturation SaaS et marketplace publique.

Priorite immediate : corriger le bug backend des images de biens, finir les pages metier front branchees aux endpoints existants, puis durcir la prod/securite.

## Stack technique

- Backend : Django, Django REST Framework, Djoser, SimpleJWT, django-axes, django-celery-beat, Celery, Redis, PostgreSQL, ReportLab, Africa's Talking, CinetPay.
- Frontend : Next.js 16.2, React 19, TypeScript, Tailwind CSS 4, shadcn/Radix UI, Recharts, axios, lucide-react, react-leaflet.
- Architecture : API versionnee `/api/v1/`, multi-tenant par `X-Agency-ID`, JWT avec rotation des refresh tokens.
- Donnees : PostgreSQL en local via Docker, seed realiste via commande Django.

## Backend implemente

### Authentification et securite

- [x] Utilisateur custom avec `phone_number`, `email`, `full_name`.
- [x] Inscription, activation, login email/telephone, refresh JWT, logout, logout global, reset password.
- [x] Djoser configure avec templates email custom.
- [x] SimpleJWT avec rotation et blacklist des refresh tokens.
- [x] django-axes, throttling DRF, audit log minimal pour auth.
- [x] Pages HTML Django pour activation et reset password.

### Multi-tenant et agences

- [x] Modeles `Agency`, `AgencyMembership`, roles `owner`, `manager`, `agent`, `viewer`.
- [x] Filtrage par agence via `X-Agency-ID`, `X-Org-ID`, query param ou claim JWT.
- [x] Permissions par roles : owner, owner/manager, operator.
- [x] CRUD agences pour les membres authentifies.
- [x] Membres d'agence : liste, ajout, detail, modification, suppression.
- [x] Invitations equipe par email : creation, relance, revocation, lecture publique, acceptation.
- [x] Auto-inscription lors d'une invitation si l'email n'existe pas.
- [x] Commande `expire_invitations`.

### Biens, immeubles, pieces et marketplace

- [x] Modeles `Building`, `Property`, `PropertyImage`, `Room`, `Listing`.
- [x] CRUD immeubles, biens, images de biens, pieces, annonces.
- [x] Champs riches : type, surface, chambres, equipements, disponibilite, geolocalisation, photos.
- [x] Filtres biens : immeuble, type, disponibilite.
- [x] Marketplace publique : listings publies uniquement, filtres prix/type/chambres/surface/equipements/geoloc/rayon.
- [x] Validation cross-agency sur immeubles, biens, listings, images et rooms.

### Locataires et baux

- [x] Modeles `Tenant` et `Lease`.
- [x] CRUD locataires avec recherche, filtres, tri et pagination.
- [x] CRUD baux avec lien vers bien et locataire.
- [x] Hydratation automatique des infos bail depuis le locataire.
- [x] Historique locataire : baux + paiements pagines.
- [x] Preferences de notification par locataire.
- [x] Verification WhatsApp par code.
- [x] Export CSV des locataires et des baux.
- [x] Relance manuelle d'un bail.

### Paiements et finance

- [x] Modele `Payment` avec statuts `pending`, `paid`, `failed`.
- [x] CRUD paiements, filtrage agence et validation bail/agence.
- [x] Generation de quittance PDF via ReportLab.
- [x] Envoi email de quittance avec PDF en piece jointe.
- [x] Option `PAYMENT_AUTO_SEND_RECEIPT`.
- [x] Export CSV des paiements.
- [x] Dashboard finance : revenus, encaissements, impayes, occupation, baux actifs, historique 6 mois.

### Notifications

- [x] Modeles `NotificationLog` et `TenantNotificationPreference`.
- [x] Services email, SMS et WhatsApp.
- [x] Simulation locale SMS/WhatsApp.
- [x] Relances automatiques selon `RENT_REMINDER_DAYS`.
- [x] Anti-spam via `REMINDER_COOLDOWN_DAYS`.
- [x] Logs filtrables par statut, canal, template, bail, locataire et dates.
- [x] Dashboard notifications par statut et par canal.
- [x] Queue des relances a traiter.
- [x] Relance en masse avec message template.
- [x] Commande `send_rent_reminders` et tache Celery associee.

### Billing SaaS

- [x] Modeles `Plan`, `AgencySubscription`, `AgencyInvoice`.
- [x] Plans publics en lecture, administration reservee aux admins.
- [x] Creation/changement d'abonnement par agence.
- [x] Cancel/resume d'abonnement.
- [x] Factures d'agence en lecture seule.
- [x] Paiement manuel de facture.
- [x] PDF de facture.
- [x] Checkout CinetPay et webhook de confirmation.
- [x] Commande/tache d'expiration des trials.

### Ops, dev et tests

- [x] Commande `seed_data` avec dataset reproductible.
- [x] Commande `setup_periodic_tasks`.
- [x] Suivi `TaskRun` des taches periodiques.
- [x] Endpoint `ops/tasks/`.
- [x] Alertes email ops en cas d'echec de tache.
- [x] Docker Compose local pour PostgreSQL.
- [x] Tests backend nombreux : auth, agences, properties, leases, payments, notifications, billing, ops.
- [x] Docs backend presentes : deploiement, notifications, debug, reset DB.

## Frontend implemente

### Socle application

- [x] App Next.js avec App Router.
- [x] TypeScript, Tailwind, composants UI shadcn/Radix.
- [x] Theme light/dark via `next-themes`.
- [x] Layout dashboard protege par `AuthGuard`.
- [x] Sidebar, header, selection d'agence active.
- [x] `AgencyContext` avec agence active en `localStorage`.

### Authentification

- [x] Pages login, signup, forgot password, reset password, activation.
- [x] Formulaires branches aux endpoints Djoser/JWT.
- [x] `AuthContext` avec login, logout, logout global, register, refresh user.
- [x] Intercepteur axios : injection Bearer token, refresh proactif, retry apres 401.
- [x] Normalisation des erreurs API.
- [x] Redirection si non authentifie.

### Agences

- [x] Page `/dashboard/agences`.
- [x] Liste des agences de l'utilisateur.
- [x] Creation d'agence.
- [x] Selection de l'agence active.
- [x] Cartes recap : total agences, membres cumules, agence active.

### Dashboard et analytics

- [x] Dashboard principal avec KPIs financiers.
- [x] Graphique des revenus locatifs.
- [x] Activites recentes issues de paiements, baux, locataires, notifications.
- [x] Alertes issues de paiements pending/failed et notifications failed/pending.
- [x] Page `/dashboard/activities` avec filtres et export CSV client.
- [x] Page `/dashboard/alerts` avec filtres.
- [x] Page `/dashboard/analytics` branchee au dashboard finance.

### Biens, immeubles, pieces

- [x] Page `/dashboard/biens` tres avancee : liste, recherche, filtres, pagination, stats, creation.
- [x] Creation de bien avec champs detailles, equipements, geoloc et images.
- [x] Upload images de biens via `property-images`.
- [x] Creation d'immeuble depuis la page biens.
- [x] Creation de listing/annonce.
- [x] Page detail bien `/dashboard/biens/[propertyId]`.
- [x] Affichage des images, infos, geoloc, baux lies, rooms.
- [x] Creation de piece/room depuis le detail bien.
- [x] Page immeubles `/dashboard/biens/immeubles`.
- [x] Page detail immeuble `/dashboard/biens/immeubles/[buildingId]`.
- [x] Creation d'unite depuis un immeuble.
- [x] Composants carte Leaflet et recherche adresse Nominatim.

### Notifications

- [x] Page `/dashboard/notifications` avancee.
- [x] Dashboard notifications.
- [x] Logs de notifications avec filtres.
- [x] Queue de relances.
- [x] Relance en masse.
- [x] Relance individuelle via service bail.

## Ce qui reste a faire

### Corrections prioritaires

- [ ] Corriger `PropertyImageViewSet.get_queryset` : il retourne actuellement des `Room` au lieu de `PropertyImage`, ce qui peut casser la liste des images (`BACKEND/apps/properties/views.py`).
- [x] Supprimer le doublon `validate_property` dans `RoomSerializer` (`BACKEND/apps/properties/serializers.py`).
- [ ] Aligner la strategie token frontend : le commentaire annonce un access token en memoire, mais le code le persiste aussi dans `localStorage`.
- [ ] Mettre a jour les metadata Next.js encore en mode `Create Next App`.
- [ ] Remplacer la page `/` qui affiche encore le template Next.js par une vraie landing ou une redirection vers login/dashboard.

### Pages frontend metier a finir

- [ ] Remplacer `/dashboard/contrats` par une vraie liste CRUD des baux.
- [ ] Remplacer `/dashboard/paiements` par une vraie liste/creation des paiements.
- [ ] Remplacer `/dashboard/quittances` par une liste de quittances avec telechargement PDF et envoi email.
- [ ] Remplacer `/dashboard/reports` par des rapports/export utiles.
- [ ] Finaliser `/dashboard/locataires` : liste, creation, edition, detail, historique, preferences notifications.
- [ ] Ajouter la page publique `/accept-invite` cote Next.js ou rediriger clairement vers la page Django existante.
- [ ] Creer les pages `/settings` et `/help` ou retirer les liens de la sidebar.

### Services frontend manquants ou incomplets

- [ ] Ajouter service/hook CRUD complet pour `tenants`.
- [ ] Ajouter service/hook CRUD complet pour `leases`, pas seulement fetch/remind.
- [ ] Ajouter service/hook CRUD complet pour `payments`, recu PDF, envoi quittance et export.
- [ ] Ajouter service/hook pour `billing/plans`, `billing/subscription`, `billing/invoices`.
- [ ] Ajouter service/hook pour membres d'agence et invitations equipe.
- [ ] Ajouter service/hook pour marketplace publique.
- [ ] Ajouter gestion des editions/suppressions cote UI pour biens, immeubles, rooms, listings.

### Marketplace et public

- [ ] Construire marketplace publique `/marketplace` branchee sur `/api/v1/marketplace/listings/`.
- [ ] Construire fiche publique de bien/listing.
- [ ] Ajouter filtres publics : ville, budget, type, chambres, surface, rayon.
- [ ] Ajouter formulaire de demande de location ou contact prospect.
- [ ] Ajouter moderation/publication plus claire des listings cote agence.

### Billing et SaaS owner

- [ ] Construire UI facturation agence : plan actuel, upgrade/downgrade, invoices, PDF, checkout CinetPay.
- [ ] Appliquer les limites de plan (`max_properties`, `max_users`, `max_units`) dans les creations metier.
- [ ] Construire l'admin SaaS owner : MRR, churn, agences clientes, plans, factures, support.
- [ ] Ajouter et documenter les retours CinetPay cote frontend (`billing/return`).

### Securite et production

- [ ] Passer refresh token en cookie `httpOnly` si possible, puis activer le middleware serveur.
- [ ] Ajouter `CSRF_TRUSTED_ORIGINS`, cookies secure, HSTS et options prod Django.
- [ ] Ajouter `STATIC_ROOT` et config media/storage prod.
- [ ] Exposer OpenAPI/Swagger/Redoc si `drf-spectacular` reste dans les dependances.
- [ ] Completer Docker Compose avec backend, frontend, Redis, Celery worker et Celery beat.
- [ ] Ajouter monitoring/logging structure, Sentry ou equivalent.
- [ ] Mettre en place sauvegardes PostgreSQL et media.

### Qualite et tests

- [ ] Ajouter tests frontend : composants critiques, hooks API, auth guard, pages dashboard.
- [ ] Ajouter tests E2E Playwright pour login, creation agence, creation bien, paiement, notification.
- [ ] Ajouter tests backend pour le bug images de biens et upload multipart.
- [ ] Ajouter lint/build dans CI.
- [ ] Ajouter formatting standardise frontend/backend.
- [ ] Nettoyer textes mixtes FR/EN et accents manquants dans l'UI.

### Mobile

- [ ] Le dossier `MOBILE` est vide : choisir Flutter/React Native ou reporter officiellement.
- [ ] Definir les priorites mobiles : dashboard compact, biens, baux, paiement rapide, notifications push.
- [ ] Prevoir auth mobile et stockage token securise.

## Checklist MVP recommandee

### Phase 1 - Stabilisation

- [ ] Corriger `PropertyImageViewSet`.
- [ ] Ajouter tests backend images.
- [ ] Corriger metadata et page d'accueil.
- [ ] Retirer ou brancher les boutons Google.
- [ ] Nettoyer les liens morts sidebar.

### Phase 2 - Parcours metier essentiels

- [ ] Finaliser locataires.
- [ ] Finaliser contrats/baux.
- [ ] Finaliser paiements.
- [ ] Finaliser quittances.
- [ ] Ajouter exports UI branches aux endpoints backend.

### Phase 3 - Croissance produit

- [ ] Finaliser invitations equipe cote frontend.
- [ ] Finaliser facturation SaaS cote frontend.
- [ ] Lancer marketplace publique.
- [ ] Ajouter demandes de location.
- [ ] Ajouter parametres agence/profil.

### Phase 4 - Production

- [ ] Durcir stockage tokens/cookies.
- [ ] Completer Docker/prod/Celery/Redis.
- [ ] Ajouter CI tests lint build.
- [ ] Ajouter monitoring et backups.
- [ ] Faire un audit securite pre-prod.

## Points d'attention reperes

- Le backend est plus mature que le frontend : beaucoup d'endpoints existent mais n'ont pas encore de page UI.
- Plusieurs pages frontend sont encore placeholders : contrats, paiements, quittances, reports, locataires.
- La doc annonce un frontend "prevu" dans le README racine, alors qu'un frontend existe deja et merite d'etre documente.
- `FRONTEND/rent-flow/README.md` est encore le README genere par Next.js.
- Les boutons Google sont visibles mais ne sont pas branches a une auth OAuth.
- `middleware.ts` contient la logique cookie httpOnly en commentaire : la protection effective est surtout cote client via `AuthGuard`.
- `docker-compose.yml` ne lance que PostgreSQL, pas Redis/Celery/backend/frontend.
- Le projet dispose d'une bonne base de tests backend, mais pas de tests frontend visibles.

## Conclusion

Le MVP backend de RentFlow est solide et couvre deja la plupart des besoins metier. Le gros chantier restant est l'alignement frontend : transformer les endpoints existants en parcours complets, coherents et testables. La prochaine meilleure action est de corriger les images de biens, puis de finaliser les modules `Locataires`, `Contrats`, `Paiements` et `Quittances`, car ils ferment le cycle metier principal : bien -> locataire -> bail -> paiement -> quittance -> relance.
