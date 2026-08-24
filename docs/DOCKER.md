# Exploitation Docker et rollback

Ce document décrit le socle Compose avant les futures montées de version des
bases de données et des runtimes. Les images sont fixées par tag exact et digest
afin qu'un redéploiement ou un rollback reconstruise le même environnement.

## Fichiers Compose

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | Socle commun, réseaux privés, volumes et contrôles de santé |
| `docker-compose.override.yml` | Développement local, ports liés à `127.0.0.1` |
| `docker-compose.prod.yml` | Production, secrets obligatoires, limites et durcissement |
| `docker-compose.validation.yml` | Test isolé sans connexion réelle du bot à Discord |
| `docker-compose.vault.yml` | Vault accessible par les services et par l'hôte local uniquement |
| `icy-angular/docker-compose.ssr.yml` | Variante frontend SSR, à activer séparément |

Le socle contient PostgreSQL, RabbitMQ, le backend Spring Boot, le bot Discord,
le frontend Nginx et le service d'images. PostgreSQL et RabbitMQ ne publient
aucun port en production. Seul le frontend publie `80` et `443`.

## Développement local

Compose charge automatiquement la surcharge locale :

```powershell
docker compose up -d --build --wait
docker compose ps
docker compose down
```

Les ports de développement sont liés à l'interface locale : PostgreSQL `5432`,
RabbitMQ `5672` et `15672`, backend `8080`, frontend `8088`, images `8081`.
Les valeurs par défaut du socle sont réservées au poste de développement.

## Production

Créer un fichier ignoré par Git, par exemple `secrets/prod.secrets.env`, à
partir de la configuration du serveur. Ne jamais joindre la sortie complète de
`docker compose config` à un ticket ou à un journal : elle contient les secrets
résolus.

Valider la configuration puis déployer :

```powershell
docker compose --env-file .\secrets\prod.secrets.env `
  -f .\docker-compose.yml -f .\docker-compose.prod.yml config --quiet

docker compose --env-file .\secrets\prod.secrets.env `
  -f .\docker-compose.yml -f .\docker-compose.prod.yml `
  up -d --build --wait
```

Le fichier de production impose notamment les secrets PostgreSQL, RabbitMQ,
JWT, Discord et la clé partagée du bot. Le backend et le bot utilisent un
système de fichiers racine en lecture seule, un `/tmp` temporaire, l'option
`no-new-privileges`, des limites CPU/mémoire et une limite de processus.

## Validation isolée

La pile de validation porte ses propres noms de réseaux et de volumes. Elle ne
touche donc pas aux données locales ou de production. Le bot est placé derrière
le profil `external` pour empêcher toute connexion accidentelle à Discord.

```powershell
docker compose -p iceforge-validation `
  -f .\docker-compose.yml -f .\docker-compose.validation.yml `
  up -d --build --wait

docker compose -p iceforge-validation `
  -f .\docker-compose.yml -f .\docker-compose.validation.yml `
  down -v --remove-orphans
```

Avant fusion d'une branche d'infrastructure, vérifier au minimum :

1. la résolution de tous les fichiers avec `config --quiet` ;
2. la construction des trois images applicatives ;
3. les tests Maven, Angular et Python inclus dans les builds ;
4. un démarrage à froid avec tous les contrôles de santé au vert ;
5. un appel HTTP du frontend vers le backend ;
6. la persistance PostgreSQL et RabbitMQ après recréation des conteneurs ;
7. l'absence de ports internes publiés dans la configuration de production.

RabbitMQ possède un nom d'hôte stable (`rabbitmq`). Son identifiant de nœud et
son répertoire Mnesia restent ainsi cohérents lors d'une recréation de conteneur.

Pour le palier RabbitMQ 3.13 vers 4.2, relever d'abord les plugins, politiques,
files et feature flags de la production. Tous les flags stables 3.13 doivent être
activés et Khepri doit rester désactivé avant la montée. Arrêter proprement le
broker, sauvegarder son volume avec les métadonnées et propriétaires, puis
démarrer 4.2 avec le même nom d'hôte. Vérifier les messages persistants et les
deux clients applicatifs avant d'activer les nouveaux flags 4.2.

L'activation de tous les flags 4.2 inclut Khepri et rend le changement
irréversible au niveau du volume. Le rollback supporté consiste à arrêter 4.2 et
à restaurer la sauvegarde réalisée sous 3.13 avec l'image 3.13 d'origine. Ne
jamais essayer de démarrer directement une ancienne image sur le volume migré.

## Vault

Vault rejoint le réseau privé `iceforge_internal`, ce qui rend l'adresse
`http://vault:8200` accessible au backend et au bot. Son port d'administration
est publié uniquement sur `127.0.0.1:8200` pour une utilisation locale ou via un
tunnel SSH. Ne jamais publier ce port directement sur Internet.

## Sauvegarde et rollback

Une mise à jour applicative et une mise à jour de service stateful doivent rester
sur des branches distinctes. Avant toute montée majeure de PostgreSQL,
RabbitMQ ou Vault :

1. sauvegarder la base ou les données avec l'outil natif du service ;
2. tester la restauration dans un projet Compose isolé ;
3. noter le commit Git, le tag et le digest de l'image précédente ;
4. documenter si le format de données autorise réellement un retour de version ;
5. déployer, vérifier la santé et exécuter les tests fonctionnels ciblés.

Pour une modification stateless, revenir au commit précédent puis relancer
Compose suffit généralement. Pour PostgreSQL, RabbitMQ ou Vault, ne jamais
redescendre simplement l'image après une migration de format : arrêter le
service et restaurer la sauvegarde validée avec la version antérieure.

Les volumes nommés (`postgres_data`, `rabbitmq_data`, `backend_logs`,
`bot_config`, `icy_images_data`) ne sont pas supprimés par `docker compose down`.
L'option `down -v` est réservée à la pile isolée `iceforge-validation`.
