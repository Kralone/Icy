# Promotion du backend Java 25 / Spring Boot 4.1

> Cette page décrit la consolidation historique terminée le 25 août 2026. Les
> exigences « V29 libre » et `verify-flyway-v28.sql` sont le point de contrôle de
> cette ancienne opération, avant livraison de V29. Elles ne doivent pas servir à
> valider le candidat de stabilisation actuel. Pour ce candidat, suivre
> `PRODUCTION-V29-SECURITY.md` après sauvegarde et répétition sur copie restaurée.

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

Le script `prepare-volumes.sh` possède trois modes :

```bash
BACKEND_IMAGE="iceforge/backend:<commit>" ./prepare-volumes.sh inspect
BACKEND_IMAGE="iceforge/backend:<commit>" ./prepare-volumes.sh apply
BACKEND_IMAGE="iceforge/backend:<commit>" ./prepare-volumes.sh verify
```

`apply` refuse de continuer si `iceforge_backend` est encore actif. Il exécute un
conteneur éphémère sans réseau, avec une racine en lecture seule et uniquement les
capacités nécessaires au `chown`. `verify` écrit puis supprime deux sentinelles dans
les volumes avec l'UID 10001. La répétition locale a confirmé le refus avant
préparation, le changement récursif des fichiers existants et le refus lorsque le
backend désigné tourne.

## Fichiers et ordre Compose

La production active utilise le projet `/root/iceforge` et cet ordre :

```bash
docker compose \
  --project-directory /root/iceforge \
  --env-file /root/iceforge/.env \
  --env-file /root/iceforge/.secrets/vault/compose.prod.env \
  -f /root/iceforge/docker-compose.yml \
  -f /root/iceforge/docker-compose.vault.yml \
  -f /root/iceforge/ops/network-hardening/docker-compose.network-hardening.yml \
  -f /root/iceforge/ops/backend-rollout/docker-compose.backend-java25.yml
```

Les deux fichiers d'environnement et l'overlay Vault restent obligatoires. Aucun
secret ne doit être affiché, copié dans un script ou ajouté au dépôt.

L'overlay backend impose : image immuable sans build sur le serveur, UID 10001/GID
101, racine en lecture seule, `/tmp` en tmpfs, aucune capability, `no-new-privileges`,
healthcheck local, aucun port hôte, réseaux `internal` et `external`, 2 CPU, 2 Gio de
mémoire et 200 PID. Le backend actuel consomme environ 687 Mio au repos ; cette
limite conserve une marge importante.

Avant la fenêtre de maintenance, valider le modèle effectif sans imprimer sa
configuration :

```bash
export BACKEND_IMAGE="iceforge/backend:<commit>"
/root/iceforge/ops/backend-rollout/verify.sh config
```

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

```bash
BACKEND_IMAGE="$BACKEND_IMAGE" \
  docker compose \
  --project-directory /root/iceforge \
  --env-file /root/iceforge/.env \
  --env-file /root/iceforge/.secrets/vault/compose.prod.env \
  -f /root/iceforge/docker-compose.yml \
  -f /root/iceforge/docker-compose.vault.yml \
  -f /root/iceforge/ops/network-hardening/docker-compose.network-hardening.yml \
  -f /root/iceforge/ops/backend-rollout/docker-compose.backend-java25.yml \
  up --detach --no-deps --no-build --pull never backend
```

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

Le contrôle runtime automatisé couvre ces invariants techniques :

```bash
BACKEND_IMAGE="$BACKEND_IMAGE" \
  /root/iceforge/ops/backend-rollout/verify.sh runtime
```

La même définition durcie a démarré localement sur PostgreSQL 18.6 et RabbitMQ
4.3.5 : 28 migrations appliquées, HTTP 200, zéro redémarrage, volumes accessibles,
racine non inscriptible et limites Docker effectives.

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

Pour recréer l'ancien backend, omettre l'overlay Java 25 et utiliser explicitement
l'image ID sauvegardée. Les volumes peuvent rester en `10001:101` : le conteneur root
historique conserve l'accès.

Après un rollback, ne pas retenter automatiquement la consolidation : la table
additive existe encore et le script refusera de continuer. Analyser son contenu et
préparer explicitement la nouvelle tentative.

## Go/no-go

La promotion reste interdite tant que l'image candidate immuable, l'overlay Compose,
la préparation des volumes, le dump final et le contrôle Vault n'ont pas été validés
ensemble pendant une répétition. Cette documentation et les scripts ne constituent
pas une autorisation de déploiement automatique.

## Déploiement validé du 25 août 2026

- image active : `iceforge/backend:689b22c` ;
- image ID serveur :
  `sha256:c0fd7e1863473b7c12bbf9d581dc7c573cb3e72b9f02fe41ec27c70fe3234da7` ;
- sauvegarde de rollback :
  `/var/backups/iceforge/backend-pre-java25-20260825T204550Z` ;
- image précédente exportée et contrôlée par checksum ;
- dumps PostgreSQL avant et après gel des écritures vérifiés avec `pg_restore --list` ;
- historique original V1-V43 conservé dans
  `public.flyway_schema_history_pre_v28_consolidation` ;
- historique actif : 28 migrations réussies, version V28 et V29 libre ;
- Java 25.0.4, Spring Boot 4.1.1, UID 10001/GID 101, racine read-only, zéro
  capability, `no-new-privileges`, 2 CPU, 2 Gio et 200 PID ;
- backend `healthy`, zéro redémarrage, API interne et publique en HTTP 200 ;
- Vault activé avec `fail-fast`, instance initialisée et non scellée ;
- bot reconnecté à Discord, sept files RabbitMQ avec un consommateur et zéro
  message en attente ;
- frontend, PostgreSQL, RabbitMQ, Vault et serveur d'images restés actifs pendant
  la bascule.

Un risque existant a été observé dans les logs du bot : l'URL de connexion AMQP est
journalisée avec ses identifiants. Sa correction et la rotation associée doivent
rester dans une branche de sécurité séparée du rollback backend.
