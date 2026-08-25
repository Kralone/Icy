# Suppression des identifiants AMQP dans les logs du bot

## Risque

L'image historique du bot journalise l'URL AMQP complète. Le nom d'utilisateur et
le mot de passe RabbitMQ apparaissent donc dans `docker logs`. Le nouveau code ne
journalise que le schéma, l'hôte, le port et le vhost. Les exceptions de connexion
ne rendent plus leur message potentiellement contaminé par une URL secrète.

Les valeurs par défaut applicatives du nom d'utilisateur et du mot de passe ont été
supprimées. Le démarrage échoue maintenant explicitement si les deux variables ne
sont pas fournies. Les caractères spéciaux sont encodés dans l'URL de connexion.

## Validation locale

- 9 tests réussis ;
- RabbitMQ 3.13 réel sur réseau Docker isolé ;
- mot de passe synthétique contenant `@` et `:` ;
- connexion, déclaration des files, publication et consommation réussies ;
- tests négatifs garantissant l'absence de l'utilisateur, du mot de passe et de
  l'URL complète dans les logs de succès comme d'échec.

## Déploiement

L'overlay `docker-compose.bot-amqp-redaction.yml` impose l'image immuable, l'UID et
le GID 10001, une racine en lecture seule, `/tmp` en tmpfs, aucune capability,
`no-new-privileges`, un healthcheck RabbitMQ, 0,5 CPU, 256 Mio et 100 PID.

Le volume `iceforge_bot_config`, actuellement `root:root`, doit être préparé après
arrêt du bot :

```bash
export BOT_IMAGE="iceforge/bot:<commit>"
/root/iceforge/ops/bot-rollout/verify.sh config
/root/iceforge/ops/bot-rollout/prepare-config-volume.sh inspect
# arrêter uniquement le bot
/root/iceforge/ops/bot-rollout/prepare-config-volume.sh apply
```

La recréation Compose doit inclure les fichiers d'environnement, Vault, le
durcissement réseau et l'overlay bot, puis cibler uniquement `bot` avec `--no-deps`,
`--no-build` et `--pull never`. Après démarrage :

```bash
BOT_IMAGE="$BOT_IMAGE" /root/iceforge/ops/bot-rollout/verify.sh runtime
```

## Rotation

La suppression des logs ne révoque pas le secret déjà exposé. La rotation RabbitMQ
doit mettre à jour de façon coordonnée RabbitMQ, le chemin Vault du backend, le
chemin Vault du bot et les fichiers d'environnement de secours. Le nouveau secret ne
doit apparaître ni dans une commande enregistrée, ni dans le dépôt, ni dans les logs.

La rotation reste bloquée tant qu'un jeton Vault disposant des droits d'écriture sur
les deux chemins KV n'est pas disponible. Ne modifier qu'un seul consommateur : cela
couperait soit le backend, soit le bot.

## Déploiement validé du 25 août 2026

- image active : `iceforge/bot:6eb3f25` ;
- image ID serveur :
  `sha256:77e69dec0f7301e62ae6d2b9a78246cf6bac4eb911ded00d52a71b04f87a40cc` ;
- sauvegarde de rollback :
  `/var/backups/iceforge/bot-pre-amqp-redaction-20260825T210404Z` ;
- bot `healthy`, connecté à Discord et RabbitMQ, zéro redémarrage ;
- quatre files consommées par le bot et sept files totales sans message en attente ;
- UID/GID 10001, racine read-only, aucune capability, 0,5 CPU, 256 Mio et 100 PID ;
- les logs montrent `amqp://rabbitmq:5672/` sans utilisateur ni mot de passe ;
- le vérificateur runtime recherche et bloque toute URL AMQP contenant un userinfo.

Le chemin KV bot fournit `RABBITMQ_USER` et `RABBITMQ_PSWD`. Le chemin KV backend
fournit `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD` et leurs alias Spring. Les deux
AppRoles ont uniquement la capacité `read` sur leur propre chemin ; aucun ne peut
effectuer la rotation. Le mot de passe exposé reste donc à révoquer dès qu'un jeton
Vault doté de `update` sur les deux chemins sera disponible.
