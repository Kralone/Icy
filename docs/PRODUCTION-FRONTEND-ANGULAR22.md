# Promotion du frontend Angular 22

## Portée

Cette opération remplace uniquement le conteneur `iceforge_frontend`. Le backend, le bot, PostgreSQL, RabbitMQ, Vault, les certificats et le volume `icy_images_data` ne sont ni recréés ni modifiés.

L’image cible embarque Angular 22, Node 24 pour le build et nginx 1.30.4 pour l’exécution. Elle est construite localement depuis le commit Git validé, exportée puis chargée sur le serveur : aucun build et aucun `pull` ne sont effectués pendant la bascule.

## Particularité TLS

La clé `/etc/letsencrypt/live/iceforge.fr/privkey.pem` est `root:root 0600`. Le maître nginx démarre donc en UID 0 pour lire la clé, puis crée ses workers avec l’utilisateur `nginx` (UID 101). Le conteneur reste en lecture seule et utilise `no-new-privileges`. Toutes les capacités Linux sont supprimées, puis seules `CHOWN`, `SETGID` et `SETUID` sont réautorisées pour préparer les répertoires temporaires et abandonner les privilèges des workers.

Le healthcheck sonde directement `https://127.0.0.1:8443/index.html`. La sonde ne doit pas utiliser HTTP 8080 : sa redirection mènerait `wget` vers le port interne 443, qui n’est volontairement pas écouté.

## Fichiers Compose obligatoires

Toujours conserver cet ordre et les deux fichiers d’environnement :

```bash
docker compose \
  --project-directory /root/iceforge \
  --env-file /root/iceforge/.env \
  --env-file /root/iceforge/.secrets/vault/compose.prod.env \
  -f /root/iceforge/docker-compose.yml \
  -f /root/iceforge/docker-compose.vault.yml \
  -f /root/iceforge/ops/network-hardening/docker-compose.network-hardening.yml \
  -f /root/iceforge/ops/frontend-rollout/docker-compose.frontend-angular22.yml
```

Omettre le second fichier d’environnement rendrait les identifiants AppRole Vault vides et ferait pointer les chemins KV vers le développement.

## Préparation du rollback

Avant la bascule, conserver l’ID de l’image active, exporter cette image et archiver les fichiers statiques/configuration historiques :

```bash
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="/var/backups/iceforge/frontend-pre-angular22-${stamp}"
install -d -m 0700 "$backup_dir"
docker inspect --format '{{.Image}}' iceforge_frontend >"$backup_dir/image-id.txt"
docker image save "$(cat "$backup_dir/image-id.txt")" | gzip -1 >"$backup_dir/image.tar.gz"
tar -C /root/iceforge -czf "$backup_dir/static-and-nginx.tar.gz" frontend nginx/conf.d
sha256sum "$backup_dir"/*.gz >"$backup_dir/SHA256SUMS"
chmod 0600 "$backup_dir"/*
```

Les répertoires historiques `/root/iceforge/frontend` et `/root/iceforge/nginx/conf.d` restent sur place après la bascule.

## Préflight et déploiement

Avec un tag immuable construit depuis le commit, par exemple `iceforge/frontend:<commit>` :

```bash
export FRONTEND_IMAGE="iceforge/frontend:<commit>"
/root/iceforge/ops/frontend-rollout/verify.sh config
```

Vérifier le dry-run : il ne doit planifier que la recréation de `iceforge_frontend`.

```bash
FRONTEND_IMAGE="$FRONTEND_IMAGE" FRONTEND_ROLLOUT_DIR=/root/iceforge/ops/frontend-rollout \
  docker compose \
  --project-directory /root/iceforge \
  --env-file /root/iceforge/.env \
  --env-file /root/iceforge/.secrets/vault/compose.prod.env \
  -f /root/iceforge/docker-compose.yml \
  -f /root/iceforge/docker-compose.vault.yml \
  -f /root/iceforge/ops/network-hardening/docker-compose.network-hardening.yml \
  -f /root/iceforge/ops/frontend-rollout/docker-compose.frontend-angular22.yml \
  --dry-run up --detach --no-deps --no-build --pull never frontend
```

Lancer la même commande sans `--dry-run`, attendre l’état `healthy`, puis exécuter :

```bash
FRONTEND_IMAGE="$FRONTEND_IMAGE" /root/iceforge/ops/frontend-rollout/verify.sh runtime
```

## Rollback

Le rollback réactive la définition historique, sans l’overlay Angular 22 :

```bash
docker compose \
  --project-directory /root/iceforge \
  --env-file /root/iceforge/.env \
  --env-file /root/iceforge/.secrets/vault/compose.prod.env \
  -f /root/iceforge/docker-compose.yml \
  -f /root/iceforge/docker-compose.vault.yml \
  -f /root/iceforge/ops/network-hardening/docker-compose.network-hardening.yml \
  up --detach --no-deps --no-build --pull never frontend
```

Si l’ancienne image locale a disparu, la recharger d’abord avec `gunzip -c image.tar.gz | docker image load`. Contrôler ensuite `https://iceforge.fr/`, `https://iceforge.fr/api/front/members`, les logs nginx et les huit ports externes interdits décrits dans le durcissement réseau.

## Déploiement validé du 25 août 2026

- image active : `iceforge/frontend:8e2b2f04e584` ;
- image ID Docker : `sha256:d695cfbb61047121e3af5a20a9d32b9d32678665e0d56ca884dcaf4f206547c7` ;
- provenance exposée par le label OCI et `/assets/version.json` : commit `8e2b2f04e584` ;
- sauvegarde de rollback : `/var/backups/iceforge/frontend-pre-angular22-20260825T103756Z` ;
- 47 tests unitaires réussis, 45 fichiers de tests, audit npm à zéro vulnérabilité ;
- build Angular réussi avec quatre avertissements de budget CSS non bloquants ;
- préproduction isolée réussie avec les vrais certificats, le volume de 28 images et le proxy vers le backend ;
- runtime final `healthy`, zéro redémarrage, nginx valide, filesystem read-only, maître root et workers UID 101 ;
- accueil, recrutement, guides, utilitaires, Wikelo, marché des vaisseaux, login et redirection de la zone privée validés dans un navigateur ;
- PostgreSQL, RabbitMQ, Vault, backend, bot et serveur d'images restés actifs avec zéro redémarrage ;
- depuis Internet, seuls 22, 80 et 443 sont ouverts parmi les ports contrôlés.

Points non bloquants à traiter séparément : l'image distante `sibyllasc.fr/.../Refinery_01_V2-Min.jpg.webp` ne charge plus sur les menus de ressources, des transitions Angular peuvent journaliser un timeout lors de navigations automatisées très rapides, et le contrôle mobile 390 px n'a pas pu être reproduit car le navigateur intégré a conservé un viewport de 1280 px.
