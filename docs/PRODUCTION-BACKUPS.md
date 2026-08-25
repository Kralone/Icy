# Sauvegardes et reprise de production

Ce runbook définit une sauvegarde restaurable d'IceForge avant toute mise à
jour stateful. Une copie qui n'a jamais été restaurée n'est pas considérée comme
une sauvegarde validée.

## Périmètre et niveau de service

| Donnée | Sauvegarde | Cohérence | Restauration attendue |
|---|---|---|---|
| PostgreSQL | dump custom avec propriétaires/ACL, globaux sans mots de passe, inventaire | en ligne | base vierge de la version source exacte pour le rollback |
| RabbitMQ | définitions JSON | en ligne | topologie d'un broker vierge |
| RabbitMQ | volume Mnesia | arrêt bref explicite | même version, hostname et nom de nœud |
| Vault | snapshot Raft natif | en ligne | cluster Vault isolé, clés d'unseal de la source |
| Images | archive du volume | arrêt bref du backend | volume vierge avec propriétaires préservés |
| Configuration du bot | archive optionnelle | arrêt bref du bot | volume vierge |

La production observée le 24 août 2026 n'avait ni sauvegarde récente planifiée,
ni réplication PostgreSQL, ni second nœud Vault. L'objectif initial recommandé
est donc un **RPO de 24 heures** pour PostgreSQL, Vault, uploads et configuration
du bot, et un **RTO de 4 heures**, à mesurer lors de la première répétition. Les
messages RabbitMQ en transit ont un RPO « dernière copie physique planifiée » :
la topologie est exportée quotidiennement, mais le volume cohérent exige un arrêt
bref et devient obligatoire juste avant toute migration.

## Modèle de sécurité

Les dumps, définitions RabbitMQ, volumes et snapshots Vault sont des secrets.
Ils peuvent contenir données métier, hashes de mots de passe, cookie Erlang ou
tokens persistants. Les scripts appliquent `umask 077`, refusent d'écraser un
artefact et n'affichent jamais les secrets résolus par Compose.
Les définitions RabbitMQ intermédiaires vivent dans `/dev/shm` (tmpfs) et sont
supprimées dès leur copie terminée. PostgreSQL et Vault sont diffusés directement
vers le staging sans copie dans le writable layer du conteneur et sans limite de
taille implicite du tmpfs.

En production :

- travailler dans `/run/iceforge-backup`, normalement en mémoire, mode `0700` ;
- chiffrer avec `age` vers une clé de reprise conservée hors du serveur ;
- envoyer le bundle chiffré vers un stockage distant versionné et immuable ;
- conserver au moins 7 quotidiennes, 4 hebdomadaires et 6 mensuelles ;
- ne garder publiquement que le checksum du fichier chiffré ;
- ne jamais inclure la clé privée `age`, les clés d'unseal ou le token Vault ;
- ne jamais joindre `docker inspect` complet ou `docker compose config`, qui
  exposent les variables secrètes interpolées.

Appliquer la règle 3-2-1 : trois copies, deux supports, une copie hors hôte. Un
snapshot de l'hébergeur est une couche supplémentaire, pas le remplacement des
exports applicatifs. Activer aussi les snapshots automatiques Hostinger s'ils ne
le sont pas déjà.

## Scripts

Les scripts Linux se trouvent dans [`ops/backups`](../ops/backups). Ils utilisent
les conteneurs réellement démarrés par Compose ; aucun nom de volume de
production n'est supposé. L'image helper d'archive est fixée par digest et le
volume source est monté en lecture seule.
Un verrou non bloquant `/run/lock/iceforge-backup.lock`, partagé aussi par les
scripts spécialisés, interdit deux copies concurrentes et reste tenu jusqu'à la
fin du chiffrement.
L'hôte doit fournir Bash, Docker Compose, `flock` (util-linux), GNU tar, gzip,
coreutils et `age`. Valider leurs versions dans la fenêtre de préproduction ;
ne jamais télécharger un binaire depuis le job de sauvegarde lui-même.

Avant la première exécution :

```bash
sudo install -d -m 0700 /run/iceforge-backup /var/backups/iceforge
sudo install -m 0600 /dev/null /run/iceforge-backup/vault-snapshot.token
sudoedit /run/iceforge-backup/vault-snapshot.token
sudo install -m 0600 ops/backups/recovery-files.example \
  /run/iceforge-backup/recovery-files
sudoedit /run/iceforge-backup/recovery-files
```

Le token doit être court, renouvelé par le planificateur et limité à la lecture
du snapshot Raft :

```hcl
path "sys/storage/raft/snapshot" {
  capabilities = ["read"]
}
```

Sauvegarde quotidienne en ligne :

```bash
sudo ops/backups/backup-all.sh \
  --output-dir /var/backups/iceforge \
  --vault-token-file /run/iceforge-backup/vault-snapshot.token \
  --age-recipient 'age1REMPLACER_PAR_LA_CLE_DE_REPRISE' \
  --images --bot-config \
  --config-root /root/iceforge \
  --config-list /run/iceforge-backup/recovery-files \
  -- \
  --project-name iceforge \
  --env-file /root/iceforge/.env \
  -f /root/iceforge/docker-compose.yml \
  -f /root/iceforge/docker-compose.prod.yml \
  -f /root/iceforge/docker-compose.vault.yml
```

Avant une migration, ajouter `--offline-rabbitmq` et une option
`--runtime-image-service` pour **chaque** image réellement exécutée, notamment
`db`, `rabbitmq`, `vault`, `backend`, `bot` et `frontend`. L'archive conserve
ainsi les binaires exacts nécessaires au rollback, même si le tag distant change
ou disparaît. Ces options, ainsi que `--images` et `--bot-config`, entraînent des
arrêts ou copies ciblés. Un `trap` redémarre RabbitMQ ou le service applicatif
même si l'archive échoue. Vérifier ensuite explicitement les checksums, l'état
des conteneurs et les endpoints applicatifs.

Le délai d'arrêt est de 120 secondes. `ICEFORGE_BACKUP_STOP_TIMEOUT` permet de
le réduire uniquement en répétition ou de l'ajuster entre 1 et 600 secondes ;
conserver la valeur par défaut en production tant que la durée d'arrêt propre
des applications n'a pas été mesurée.

`--allow-plaintext` exige à la fois
`ICEFORGE_BACKUP_ALLOW_PLAINTEXT_TEST=1` et un nom de projet Compose explicite
`iceforge-backup-*`. Il existe uniquement pour la répétition locale isolée et
ne doit jamais être utilisé par le timer de production. La configuration hôte
et les images runtime y restent interdites, même avec cette double confirmation.

La variable `ICEFORGE_BACKUP_DOCKER_OUTPUT_VOLUME` est un adaptateur de test
pour exécuter les scripts depuis un conteneur Docker CLI. En production, la
laisser absente afin que les archives soient écrites dans le chemin hôte absolu.

`docker-compose.backup-test.yml` contient uniquement des services autonomes,
sans port publié. Ses services `backend` et `bot` sont des writers dormants qui
servent à éprouver l'arrêt et la copie des volumes ; ils ne lancent aucune
application IceForge et ne se connectent ni à Discord ni à Internet.

La liste de configuration est une liste blanche : chemins relatifs, sans glob,
sans `..` et sans symlink en tête. Elle permet d'archiver le Compose réellement
déployé, Nginx, Vault HCL et, si le plan de reprise l'exige explicitement, le
fichier d'environnement. Ne jamais y ajouter la clé privée `age`, les clés
d'unseal ou leur répertoire. `runtime-images.tar.gz` conserve les images par ID
réellement exécuté ; les restaurer avec :

```bash
gzip -dc runtime-images.tar.gz | docker image load
```

Inspecter `runtime-images.txt` et `recovery-config-paths.txt` avant toute remise
en place. Ne jamais extraire directement une configuration par-dessus un hôte
actif.

## Validation et restauration PostgreSQL

Déchiffrer le bundle uniquement dans un environnement isolé et chiffré, puis
démarrer une cible vierge utilisant l'image PostgreSQL source exacte.
`verify-all.sh` valide tous les checksums, refuse un bundle incomplet, refuse une
version serveur différente et restaure le dump avec `pg_restore --exit-on-error` :

```bash
BACKUP_TEST_POSTGRES_IMAGE='sha256:<ID exact de runtime-images.txt>' \
  ops/backups/verify-all.sh \
  --backup-dir /run/iceforge-restore/iceforge-YYYYMMDDTHHMMSSZ \
  -- --project-name iceforge-backup-restore \
  -f docker-compose.backup-test.yml
```

Recharger d'abord `runtime-images.tar.gz` avec `docker image load`, puis reprendre
dans `runtime-images.txt` l'ID du service `db`. Les
variables `BACKUP_TEST_RABBITMQ_IMAGE` et `BACKUP_TEST_VAULT_IMAGE` permettent la
même sélection exacte pour leurs répétitions de reprise.

La base de contrôle `iceforge_restore_verify` doit être absente avant le test.
Le contrôle utilise `--no-owner --no-acl` pour rester portable, mais l'archive
conserve ces métadonnées pour une reprise fidèle. Examiner puis appliquer
`postgresql-globals.sql` depuis un compte bootstrap dont le nom diffère de tous
les rôles source, avant la restauration finale ; les mots de passe des rôles en
sont volontairement exclus et doivent être réinjectés depuis le coffre de
reprise, jamais depuis le bundle.

Cette comparaison exacte prouve le rollback et la reprise après sinistre. Elle
ne valide volontairement pas une migration majeure : les versions serveur et
d'extensions, ainsi que le rendu de certaines vues, peuvent changer légitimement.
Pour PostgreSQL 15 vers 18, conserver ce backup restaurable sur PostgreSQL 15,
puis répéter séparément la restauration logique et les contrôles sémantiques de
[`POSTGRESQL-18-MIGRATION.md`](POSTGRESQL-18-MIGRATION.md).

## Restauration RabbitMQ

Les définitions JSON recréent utilisateurs, vhosts, politiques, exchanges,
files et bindings, mais pas les messages. Les importer dans un broker vierge
avec la même version majeure, puis tester le backend Spring et le bot Python.

La restauration du volume physique exige :

1. arrêter la cible et confirmer qu'elle ne tourne plus ;
2. créer un volume vierge ;
3. extraire `rabbitmq-data.tar.gz` avec propriétaires numériques, ACL et xattrs ;
4. démarrer exactement l'image, le hostname et le nom de nœud consignés ;
5. contrôler plugins, feature flags, files, bindings et messages persistants ;
6. redémarrer une seconde fois et consommer un message sentinelle.

Ne jamais ouvrir un volume déjà migré avec une image RabbitMQ plus ancienne.
Restaurer l'archive prise avant migration dans un autre volume.

## Restauration Vault

Le snapshot Raft ne contient pas les clés d'unseal utilisables hors bande. Une
restauration réelle doit donc disposer séparément des clés de la source et d'un
moyen d'authentification restauré.

Dans un cluster isolé de même version :

1. initialiser temporairement la cible et l'unseal ;
2. transmettre le token de restauration par fichier protégé ou stdin ;
3. exécuter `vault operator raft snapshot restore -force vault-raft.snap` ;
4. redémarrer, puis unseal avec **les clés de la source** ;
5. vérifier KV, AppRole, politiques et audit devices sans afficher de secret ;
6. redémarrer encore et répéter les contrôles.

La migration Vault 2.x reste interdite tant qu'une image Community corrigée ne
passe pas le scan décrit dans [`VAULT-2-MIGRATION.md`](VAULT-2-MIGRATION.md).

## Preuve de répétition locale

La branche `codex/prod-backups` a été répétée le 24 août 2026 sur des données
exclusivement synthétiques et des projets Docker dédiés. Aucune donnée locale ou
de production n'a été ouverte.

| Contrôle | Résultat |
|---|---|
| Bash `-n`, ShellCheck 0.11 et résolution Compose | réussi, zéro avertissement |
| PostgreSQL | dump et inventaire issus du même snapshot exporté pendant des écritures concurrentes ; globaux appliqués via un bootstrap distinct ; inventaires, Flyway, lignes, séquences et sentinelle identiques ; propriétaires et ACL présents dans l'archive |
| RabbitMQ | définitions exportées, volume restauré avec le même hostname, message persistant présent après deux démarrages |
| Vault | snapshot diffusé directement sans tmpfs puis restauré dans un volume vierge, clé d'unseal source acceptée, KV conforme après deux démarrages |
| Images et configuration du bot | deux archives restaurées dans des volumes vierges, contenu conforme, writers redémarrés |
| Actifs de reprise | configuration à liste blanche exacte, traversée `../` refusée, images Docker sauvegardées par ID puis rechargées |
| Chiffrement | bundle `age` atomique réunissant tous les modules, SHA-256 externe et internes valides, déchiffrement réussi avec une clé éphémère |
| Concurrence et écrasement | seconde exécution refusée par `flock`, répertoire existant inchangé, aucun doublon de checksum |
| Tests négatifs | token `0644`, bundle `INCOMPLETE`, projet clair de production et traversée de chemin refusés ; échec d'archive RabbitMQ suivi d'un redémarrage sain |
| Nettoyage transactionnel | partiels, checksums de module en échec et copies tmpfs retirés sans toucher aux autres artefacts |
| Nettoyage | zéro conteneur ou volume de répétition restant ; pile locale existante inchangée |

Cette preuve valide l'outillage, pas la sauvegarde réelle de la production. La
première exécution sur le serveur reste une opération autorisée séparément :
elle écrit un snapshot, crée un bundle et, en mode pré-migration, provoque des
arrêts ciblés.

## Première sauvegarde réelle partielle

Le 25 août 2026, une première copie de production a été effectuée sans arrêt
ni redémarrage de service. Elle contient le dump PostgreSQL et les définitions
RabbitMQ, chiffrés avec une clé `age` dont l'identité privée est restée hors du
serveur. Le nom du ciphertext contient volontairement `no-vault` et son
manifeste indique `vault_included=false` : cette copie ne doit pas être
présentée comme une sauvegarde complète.

Les contrôles suivants ont réussi :

- checksum du ciphertext identique sur le serveur et la copie hors hôte ;
- déchiffrement uniquement dans un volume Docker temporaire ;
- tous les checksums internes valides ;
- restauration PostgreSQL sur l'image source 15.13 exacte, inventaire identique ;
- import RabbitMQ 3.13.7, neuf files et huit exchanges persistants après
  redémarrage du broker isolé ;
- zéro restart des sept conteneurs de production et aucun staging clair restant.

Vault est absent car l'AppRole applicatif refuse, comme attendu, la capacité
`sys/storage/raft/snapshot`. Ne pas élargir cette AppRole. Créer séparément un
token court dédié à la politique de snapshot documentée plus haut, sans copier
de token administrateur dans le dépôt ou la conversation. Les uploads, la
configuration, les images applicatives et le volume physique RabbitMQ restent
également à inclure dans la sauvegarde complète pré-migration.

## Planification, alertes et preuves

Créer un service et un timer systemd seulement après la première répétition
manuelle. Le job doit échouer si le bundle chiffré n'est pas créé, si son
checksum échoue, si RabbitMQ n'est pas sain après redémarrage ou si l'envoi
distant ne confirme pas l'objet attendu.

Conserver pour chaque exécution : date UTC, commit Git, versions Docker/Compose,
checksum du ciphertext, taille, destination distante et résultat de la dernière
restauration. Copier le checksum vers un journal append-only indépendant du
serveur de production : un checksum stocké à côté du bundle ne suffit pas à
authentifier sa provenance. Ne jamais journaliser le manifeste interne ou
stdout de Vault.

Chaque mois, restaurer automatiquement PostgreSQL. Chaque trimestre, répéter la
reprise complète RabbitMQ, Vault et images sur un hôte isolé. Une branche
d'infrastructure n'est promue en production que si sa sauvegarde pré-migration
et son rollback ont été restaurés avec succès.
