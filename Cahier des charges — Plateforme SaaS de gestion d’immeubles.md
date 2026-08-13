# Cahier des charges — Plateforme SaaS de gestion d’immeubles

**Version :** 1.0  
**Date :** Août 2026  
**Projet :** Plateforme SaaS de gestion immobilière pour gérants et propriétaires  
**Nom de travail :** RENTFLOW / Life Nest (à confirmer)

---

# 1. Présentation du projet

## 1.1 Contexte

La gestion d’immeubles résidentiels et mixtes est souvent réalisée avec des outils dispersés (Excel, cahiers, WhatsApp, appels téléphoniques). Cette organisation entraîne des retards de paiement, une mauvaise traçabilité, des difficultés de communication et un manque de visibilité financière pour les propriétaires.

Le projet consiste à développer une **plateforme SaaS (Software as a Service)** accessible via le web et mobile permettant aux gérants, propriétaires et locataires de centraliser l’ensemble des opérations de gestion immobilière.

## 1.2 Objectifs

- Centraliser la gestion des immeubles et logements.
- Automatiser les loyers, charges et relances.
- Offrir une visibilité financière en temps réel aux propriétaires.
- Simplifier la communication avec les locataires.
- Réduire les impayés.
- Produire automatiquement les documents de gestion.
- Proposer une solution multi-immeubles et multi-utilisateurs.

---

# 2. Périmètre du projet

## Inclus

- Gestion des immeubles
- Gestion des logements
- Gestion des locataires
- Gestion des baux
- Gestion des loyers et charges
- Paiements en ligne
- Relances automatiques
- Maintenance et interventions
- Comptabilité de gestion
- Reporting et tableaux de bord
- Notifications
- Gestion documentaire
- Application web responsive
- API REST sécurisée

## Hors périmètre (version 1)

- Gestion de copropriété avancée
- Comptabilité fiscale certifiée
- Signature électronique qualifiée
- Marketplace de prestataires
- Gestion des ventes immobilières

---

# 3. Parties prenantes

| Acteur | Rôle |
|---|---|
| Propriétaire | Consulte son patrimoine, ses revenus et documents |
| Gérant / Administrateur de biens | Gère les immeubles et les opérations |
| Comptable | Suit les paiements et exporte les données |
| Locataire | Consulte son bail, paie son loyer et signale des incidents |
| Technicien / Prestataire | Traite les interventions |
| Super Administrateur SaaS | Administre la plateforme et les abonnements |

---

# 4. Description générale de la solution

La solution sera une plateforme **multi-tenant** : chaque client dispose d’un espace isolé avec ses propres données.

## Accès

- Web : navigateur moderne
- Mobile : PWA puis application Flutter (phase 2)

## Langues

- Français (V1)
- Anglais (prévu)

---

# 5. Fonctionnalités détaillées

# 5.1 Authentification et sécurité

## Fonctionnalités

- Inscription
- Connexion par email/mot de passe
- Réinitialisation de mot de passe
- Double authentification (2FA)
- Gestion des sessions
- Déconnexion de tous les appareils

## Règles

- Mot de passe fort obligatoire
- Journalisation des connexions

---

# 5.2 Gestion des utilisateurs et rôles

## Rôles

- Super Admin
- Admin Société
- Gérant
- Comptable
- Agent
- Propriétaire
- Locataire
- Technicien

## Fonctionnalités

- Invitation par email
- Attribution de rôles
- Permissions granulaires

---

# 5.3 Gestion du patrimoine immobilier

## Immeuble

- Nom
- Adresse
- Type
- Nombre d’étages
- Nombre de logements
- Photos
- Documents

## Logement

- Référence
- Numéro
- Surface
- Nombre de pièces
- Étage
- État
- Loyer de base
- Charges
- Statut

---

# 5.4 Gestion des propriétaires

- Fiche propriétaire
- Coordonnées
- Pièce d’identité
- Coordonnées bancaires
- Quote-part
- Historique des versements

---

# 5.5 Gestion des locataires

- Fiche locataire
- Contacts
- Pièce d’identité
- Profession
- Garant
- Historique des paiements
- Historique des incidents

---

# 5.6 Gestion des baux

## Données

- Numéro de bail
- Date début / fin
- Durée
- Loyer
- Charges
- Dépôt de garantie
- Mode de paiement
- Indexation
- Documents signés

## Automatisation

- Génération d’échéances mensuelles
- Alertes avant expiration
- Renouvellement

---

# 5.7 Gestion des loyers et charges

## Fonctionnalités

- Génération automatique des quittances
- Calcul des pénalités
- Saisie manuelle
- Paiement partiel
- Avoirs
- Régularisation des charges

## États

- Payé
- Partiellement payé
- Impayé
- En retard

---

# 5.8 Paiements en ligne

## Moyens de paiement

- Carte bancaire (Stripe)
- Orange Money
- Moov Money
- Telecel Money
- Wave (si disponible)

## Fonctionnalités

- Paiement depuis l’espace locataire
- Confirmation automatique
- Reçu PDF
- Historique des transactions

---

# 5.9 Relances automatiques

## Déclencheurs

- J-5 avant échéance
- Jour J
- J+3
- J+7
- J+15

## Canaux

- Email
- SMS
- Notification push

Messages personnalisables par client.

---

# 5.10 Maintenance et interventions

## Locataire

- Création d’un ticket
- Photos
- Priorité
- Description

## Gérant

- Affectation à un technicien
- Suivi du statut
- Validation de clôture
- Coût de l’intervention

Statuts : Ouvert / En cours / En attente / Terminé / Clôturé.

---

# 5.11 Gestion documentaire

## Documents stockés

- Baux
- États des lieux
- Quittances
- Factures
- Contrats prestataires
- Assurances

Fonctionnalités : classement, recherche, téléchargement, partage sécurisé.

---

# 5.12 Comptabilité de gestion

## Suivi

- Encaissements
- Décaissements
- Dépenses par immeuble
- Dépenses par catégorie
- Solde de trésorerie

## Exports

- PDF
- Excel
- CSV

---

# 5.13 Tableaux de bord

## Gérant

- Taux d’occupation
- Loyers encaissés
- Impayés
- Interventions ouvertes
- Revenus par immeuble

## Propriétaire

- Revenus du mois
- Rendement locatif
- Historique des versements

## Locataire

- Prochaine échéance
- Solde
- Historique des paiements

---

# 5.14 Rapports

- Balance locative
- Situation des impayés
- Journal des paiements
- Relevé propriétaire
- Échéances à venir
- Rapport de maintenance

---

# 5.15 Notifications

Centre de notifications intégré avec historique.

---

# 6. Exigences fonctionnelles

## EF-01

Le système doit permettre la création illimitée d’immeubles selon le plan d’abonnement.

## EF-02

Le système doit générer automatiquement les échéances mensuelles.

## EF-03

Le système doit envoyer des relances automatiques.

## EF-04

Le système doit produire une quittance PDF après paiement.

## EF-05

Le système doit isoler les données de chaque client SaaS.

---

# 7. Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| Disponibilité | 99,5 % minimum |
| Temps de réponse | < 2 s pour 95 % des requêtes |
| Sécurité | HTTPS obligatoire |
| Sauvegarde | Quotidienne |
| Scalabilité | Multi-tenant |
| Compatibilité | Chrome, Firefox, Edge, Safari |
| Responsive | Mobile, tablette, desktop |
| Accessibilité | WCAG AA recommandé |

---

# 8. Architecture technique

## Frontend

- Next.js / React
- Tailwind CSS
- TypeScript

## Backend

- Django
- Django REST Framework
- JWT

## Base de données

- PostgreSQL

## Stockage fichiers

- S3 compatible (AWS, Tigris…)

## Infrastructure

- Docker
- CI/CD GitHub Actions
- Hébergement cloud (Railway, Render, AWS…)

---

# 9. Sécurité

- Chiffrement TLS
- Hashage Argon2/Bcrypt
- Protection CSRF/XSS/SQLi
- Rate limiting
- Journal d’audit
- Sauvegardes chiffrées
- Politique RGPD / protection des données

---

# 10. Modèle économique SaaS

| Offre | Immeubles | Utilisateurs | Fonctionnalités |
|---|---|---|---|
| Essai | 1 | 2 | Base |
| Basique | 5 | 5 | Gestion locative |
| Pro | 20 | 20 | Paiement + rapports |
| Premium | Illimité | Illimité | API + support prioritaire |

Facturation mensuelle et annuelle.

---

# 11. API

## Endpoints principaux

- /auth
- /users
- /properties
- /buildings
- /units
- /tenants
- /leases
- /payments
- /maintenance
- /reports
- /notifications

Documentation OpenAPI/Swagger obligatoire.

---

# 12. Interfaces attendues

- Tableau de bord gérant
- Tableau de bord propriétaire
- Tableau de bord locataire
- Gestion des immeubles
- Gestion des logements
- Gestion des baux
- Paiement en ligne
- Tickets de maintenance
- Rapports

Maquettes Figma à produire avant développement.

---

# 13. Indicateurs de performance (KPI)

- Taux d’occupation
- Taux d’impayés
- Délai moyen de paiement
- Délai moyen de résolution des tickets
- Revenus mensuels récurrents (MRR)
- Taux de rétention clients

---

# 14. Planning prévisionnel

| Phase | Durée |
|---|---|
| Cadrage | 1 semaine |
| UX/UI | 2 semaines |
| Architecture | 1 semaine |
| Développement V1 | 8 semaines |
| Tests | 2 semaines |
| Déploiement pilote | 1 semaine |
| Mise en production | 1 semaine |

Durée totale estimée : **16 semaines**.

---

# 15. Tests et recette

## Types de tests

- Unitaires
- Intégration
- API
- Sécurité
- Performance
- Recette utilisateur

## Critères d’acceptation

- 0 bug bloquant
- Génération correcte des quittances
- Paiement enregistré automatiquement
- Notifications reçues
- Isolation des données vérifiée

---

# 16. Déploiement

## Environnements

- Développement
- Staging
- Production

## Livrables

- Code source
- Documentation technique
- Documentation utilisateur
- Scripts Docker
- Schéma base de données
- Documentation API

---

# 17. Maintenance et support

## Support

- Email
- Ticketing
- WhatsApp (option)

## SLA

| Niveau | Délai |
|---|---|
| Critique | 4 h |
| Majeur | 24 h |
| Mineur | 72 h |

---

# 18. Évolutions futures

- Application mobile native Flutter
- Signature électronique
- OCR factures
- IA de prédiction des impayés
- Gestion copropriété
- Comptabilité OHADA
- Marketplace prestataires
- Multi-devises

---

# 19. Contraintes réglementaires

- Respect des lois de protection des données
- Conservation des pièces justificatives
- Traçabilité des opérations financières
- Conditions générales d’utilisation
- Politique de confidentialité

---

# 20. Budget estimatif

| Poste | Estimation |
|---|---|
| UX/UI | 500 000 – 1 500 000 FCFA |
| Frontend | 1 500 000 – 3 000 000 FCFA |
| Backend | 2 000 000 – 4 000 000 FCFA |
| Infrastructure initiale | 100 000 – 500 000 FCFA |
| Tests / QA | 300 000 – 800 000 FCFA |
| Déploiement | 200 000 – 500 000 FCFA |

Total indicatif : **4 600 000 à 10 300 000 FCFA** selon l’équipe et le périmètre.

---

# 21. Critères de réussite du projet

Le projet sera considéré comme réussi si :

- les gérants peuvent gérer au moins un immeuble complet sans outil externe ;
- les propriétaires accèdent à leurs rapports financiers en temps réel ;
- les locataires peuvent payer en ligne et télécharger leurs quittances ;
- les relances automatiques réduisent les impayés ;
- la plateforme supporte au minimum 100 clients SaaS et 10 000 logements.

---

# 22. Annexes

## Glossaire

- **Immeuble** : bâtiment géré.
- **Logement** : unité locative.
- **Bail** : contrat de location.
- **Quittance** : reçu de paiement du loyer.
- **Ticket** : demande d’intervention.
- **Multi-tenant** : architecture isolant les données de chaque client.

## Exemple de workflow loyer

1. Création du bail.
2. Génération automatique des échéances.
3. Notification au locataire.
4. Paiement en ligne.
5. Confirmation du paiement.
6. Génération de la quittance PDF.
7. Mise à jour du tableau de bord propriétaire.

---

**Fin du cahier des charges**