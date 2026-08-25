# Promotion du frontend Angular 22

## Portée

Cette opération remplace uniquement le conteneur `iceforge_frontend`. Le backend, le bot, PostgreSQL, RabbitMQ, Vault, les certificats et le volume `icy_images_data` ne sont ni recréés ni modifiés.

L’image cible embarque Angular 22, Node 24 pour le build et nginx 1.30.4 pour l’exécution. Elle est construite localement depuis le commit Git validé, exportée puis chargée sur le serveur : aucun build et aucun `pull` ne sont effectués pendant la bascule.

## Particularité TLS

La clé `/etc/letsencrypt/live/iceforge.fr/privkey.pem` est `root:root 0600`. Le maître nginx démarre donc en UID 0 pour lire la clé, puis crée ses workers avec l’utilisateur `nginx`. Le conteneur reste en lecture seule, sans capacité Linux et avec `no-new-privileges`.

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

