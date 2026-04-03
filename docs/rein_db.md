# Réinitialiser la base (dev)

Ce guide sert à repartir de zéro **en local** quand :
- les données sont incohérentes,
- tu veux un dataset propre pour tester l’UI,
- tu veux rejouer un scénario précis (même seed).

## 1) Réinitialiser la DB (PostgreSQL via Docker)
À utiliser si la base est cassée ou si tu veux **tout nettoyer**.

```bash
docker exec -it rentflow_db dropdb -U rentflow rentflow_db
docker exec -it rentflow_db createdb -U rentflow rentflow_db
python manage.py migrate
```

## 2) Repeupler des données réalistes
À utiliser après les migrations pour générer des agences, biens, baux, paiements, etc.

### Dataset moyen (rapide)
```bash
python manage.py seed_data --clear --seed 42 --agencies 3 --users 4 --properties 30 --tenants 40 --leases 25 --payments 80 --notifications 60
```

### Dataset large (plus lourd)
```bash
python manage.py seed_data --clear --seed 82 --agencies 6 --users 8 --properties 60 --tenants 80 --leases 50 --payments 160 --notifications 120
```

**Pourquoi `--seed` ?**  
Tu obtiens **toujours les mêmes données**, pratique pour reproduire des bugs.

## 3) Identifiants de test (seed)
Mot de passe par défaut :
```
Password123!
```
