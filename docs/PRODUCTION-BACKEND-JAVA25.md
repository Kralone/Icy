# Promotion du backend Java 25 / Spring Boot 4.1

## Portée

Cette procédure prépare la promotion du seul backend vers Java 25.0.4 et Spring
Boot 4.1.1. Elle réconcilie aussi l'ancien historique Flyway de production avec
l'historique consolidé V1 à V28. PostgreSQL, RabbitMQ, Vault, le bot et le frontend
ne changent pas de version dans cette opération.

La production observée le 25 août 2026 utilise PostgreSQL 15, possède une base de
15 Mo et 43 migrations réussies, de l'ancienne V1 à l'ancienne V43. Elle ne possède
pas `core.refresh_tokens`. Un simple `flyway repair` est interdit : il remplacerait
le checksum de l'ancienne V28 sans exécuter le SQL de la nouvelle V28.

## Résultat de la répétition locale

Une copie cohérente de production a été diffusée par `pg_dump` directement vers un
PostgreSQL 15.13 local, sans fichier intermédiaire. La production n'a été ni arrêtée
ni modifiée.

Le scénario suivant a réussi deux fois :

1. validation de l'empreinte exacte de l'historique V1-V43 ;
2. sauvegarde transactionnelle de la table d'historique ;
3. conversion des métadonnées V21-V27 vers l'historique consolidé ;
4. retrait des anciennes entrées V28-V43, sans toucher au schéma ni aux données ;
5. démarrage du backend candidat ;
6. application réelle de `V28__create_refresh_tokens.sql` ;
7. validation Hibernate du schéma, connexion RabbitMQ et réponse HTTP 200 ;
8. résultat Flyway exact : 28 migrations réussies, version courante V28 et V29
   libre.

Le rollback a aussi été testé. Il restaure exactement les 43 entrées originales,
avec l'empreinte `efdc0d3a1ba42834b260125e6c8dc9d3`. La table additive
`core.refresh_tokens` est volontairement conservée afin de ne détruire aucun jeton ;
l'ancien backend peut ignorer cette table supplémentaire.

## Préconditions de production

- confirmer qu'un snapshot Hostinger récent et restaurable est disponible ;
- produire un dump logique final pendant la fenêtre de maintenance ;
- conserver l'image ID du backend actuel et son export pour le rollback ;
- arrêter le backend et le bot afin de geler les écritures applicatives ;
- vérifier que PostgreSQL est toujours V1-V43, sans échec, avec l'empreinte attendue ;
- vérifier que `core.refresh_tokens` est absente ;
- préparer les volumes pour l'UID 10001 du nouveau backend.

Les volumes actuels `iceforge_backend_logs` et `icy_images_data` sont possédés par
`root:root` avec le mode 0755. Le candidat s'exécute comme `iceforge`, UID 10001 et
GID 101. Sans correction préalable des propriétaires, il ne peut pas écrire ses
logs ni créer le dossier d'avatars. Changer les propriétaires vers `10001:101` ne
gêne pas le rollback : l'ancien backend root conserve l'accès et les lecteurs nginx
continuent à lire les fichiers.

## Fichiers et ordre Compose

La production active utilise le projet `/root/iceforge` et cet ordre :

```bash
docker compose \
  --project-directory /root/iceforge \
  --env-file /root/iceforge/.env \
  --env-file /root/iceforge/.secrets/vault/compose.prod.env \
  -f /root/iceforge/docker-compose.yml \
  -f /root/iceforge/docker-compose.vault.yml \
  -f /root/iceforge/ops/network-hardening/docker-compose.network-hardening.yml
```

Les deux fichiers d'environnement et l'overlay Vault restent obligatoires. Aucun
secret ne doit être affiché, copié dans un script ou ajouté au dépôt.

## Réconciliation Flyway

Après arrêt du backend et du bot, exécuter le script avec `ON_ERROR_STOP`. Il prend
un verrou exclusif, vérifie les 43 versions et leur empreinte, puis travaille dans
une transaction unique :

```bash
docker exec -i iceforge_db \
  psql -U iceforge -d iceforge_db \
  </root/iceforge/ops/backend-rollout/reconcile-flyway-v28.sql
```

Le résultat attendu avant le démarrage candidat est V1-V27. Démarrer ensuite
uniquement le backend candidat. Flyway doit annoncer l'application d'une migration
et la version V28 ; Hibernate doit terminer sa validation.

Exécuter alors le contrôle en lecture seule :

```bash
docker exec -i iceforge_db \
  psql -U iceforge -d iceforge_db \
  </root/iceforge/ops/backend-rollout/verify-flyway-v28.sql
```

Le résultat attendu est `28 | 28 | true | core.refresh_tokens`. Vérifier aussi :

- conteneur backend `healthy`, sans redémarrage ;
- Java 25.0.4 et utilisateur `iceforge` ;
- `https://iceforge.fr/api/front/members` en HTTP 200 ;
- authentification et rotation du refresh token ;
- files RabbitMQ connectées, sans accumulation de messages ;
- Vault AppRole fonctionnel et aucun secret dans les logs ;
- bot redémarré seulement après validation du backend.

## Rollback

Arrêter le backend candidat, puis restaurer l'ancien historique :

```bash
docker exec -i iceforge_db \
  psql -U iceforge -d iceforge_db \
  </root/iceforge/ops/backend-rollout/rollback-flyway-v28.sql
```

Le script refuse toute base qui n'est pas exactement en V1-V28 ou dont la sauvegarde
V1-V43 ne possède pas l'empreinte attendue. Il ne supprime ni table ni jeton. Recréer
ensuite l'ancien backend avec son image conservée et vérifier l'API, l'authentification,
RabbitMQ et le bot.

Après un rollback, ne pas retenter automatiquement la consolidation : la table
additive existe encore et le script refusera de continuer. Analyser son contenu et
préparer explicitement la nouvelle tentative.

## Go/no-go

La promotion reste interdite tant que l'image candidate immuable, l'overlay Compose,
la préparation des volumes, le dump final et le contrôle Vault n'ont pas été validés
ensemble pendant une répétition. Cette documentation et les scripts ne constituent
pas une autorisation de déploiement automatique.
