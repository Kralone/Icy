# Déploiement de production

`deploy-application-release.sh` promeut uniquement les images immuables du
backend, du bot et du frontend. Il ne recrée jamais PostgreSQL, RabbitMQ ou
Vault et n'utilise ni `build` ni `pull` sur le serveur.

Avant la première modification, le script :

- valide les trois images et la configuration Compose durcie ;
- vérifie en lecture seule l'historique Flyway, la continuité administrateur et
  les préconditions de V30 ;
- crée et vérifie une sauvegarde chiffrée complète ;
- conserve les trois références d'images précédentes dans un fichier `0600`.

Les composants sont ensuite recréés et vérifiés dans l'ordre backend, bot,
frontend. Une erreur déclenche le retour automatique aux trois images
précédentes. Les migrations V29 et V30 restent compatibles avec ce rollback.

Précontrôle sans sauvegarde ni recréation :

```bash
sudo /root/iceforge/ops/production/deploy-application-release.sh \
  --revision <sha-git> \
  --age-recipient 'ssh-ed25519 AAAA...' \
  --preflight
```

Déploiement :

```bash
sudo /root/iceforge/ops/production/deploy-application-release.sh \
  --revision <sha-git> \
  --age-recipient 'ssh-ed25519 AAAA...'
```

Après un rollback applicatif sans restauration de données, une nouvelle
tentative peut réutiliser pendant vingt-quatre heures une sauvegarde créée et validée
par ce même processus. Son chemin et son fichier `.sha256` sont revérifiés :

```bash
sudo /root/iceforge/ops/production/deploy-application-release.sh \
  --revision <sha-git> \
  --verified-backup /var/backups/iceforge/iceforge-<horodatage>.tar.gz.age
```

Les migrations de PostgreSQL 15 vers 18 et de RabbitMQ 3 vers 4 sont des
opérations stateful distinctes. Elles ne doivent pas être ajoutées à cette
commande applicative.

La précédente release interface appliquait V32. Ce paragraphe est historique ; la procédure actuelle est décrite dans « Catalogue ressources V33 » ci-dessous.
préalable accepte V31 ou une V32 déjà appliquée, en conservant les chemins de
mise à niveau antérieurs. Après le démarrage du backend,
`backend-rollout/verify-flyway-v32.sql` contrôle en lecture seule l’historique
exact V1–V32, les structures CIG Watch, les recettes Wikelo et les corrections
du catalogue. Ce fichier doit accompagner `backend-rollout/verify.sh` dans
le répertoire de rollout du serveur.

Le script charge l’image LibreTranslate épinglée par digest si elle manque,
avant la sauvegarde. Après la sauvegarde, il démarre ce service explicitement
et attend son état sain avant de remplacer le backend : les déploiements
applicatifs utilisent `--no-deps` et ne le démarreraient pas automatiquement.
Le mode `--preflight` ne télécharge aucune image et ne démarre aucun service.
La traduction anglais/français reste interne, sans port hôte ni clé payante,
avec un volume persistant pour les modèles et des plafonds de 2 CPU / 2 Gio.
Prévoir jusqu’à 15 minutes pour le premier téléchargement des modèles et la
mémoire correspondante en plus de celle des applications.

Un échec du démarrage de la traduction laisse les trois images applicatives
en place. Le rollback applicatif conserve ce service et son volume ; il ne
revient pas sur la migration SQL. Les paramètres `CIG_WATCH_TRANSLATION_URL`,
`CIG_WATCH_PUBLISHING_ENABLED` et `CIG_WATCH_DISCORD_ENABLED` restent fournis
par la configuration externe existante. Le workflow de sauvegarde ne change pas.

## Maintenance AlmaLinux 9

`system/update-almalinux9.sh` contrôle ou applique les mises à jour du VPS. Le
mode d'application refuse de démarrer sans sauvegarde chiffrée vérifiée. Il ne
modifie ni la configuration/version de Vault ni SSH. La désactivation de
`rpcbind` est optionnelle et refusée automatiquement si NFS est utilisé.

```bash
sudo /root/iceforge/ops/production/system/update-almalinux9.sh --check

sudo /root/iceforge/ops/production/system/update-almalinux9.sh \
  --apply \
  --verified-backup /var/backups/iceforge/iceforge-<horodatage>.tar.gz.age \
  --disable-unused-rpcbind
```

Le redémarrage reste explicite avec `--reboot`, afin de pouvoir vérifier les
conteneurs et organiser la coupure avant de charger le nouveau noyau.

Une mise à jour de Docker peut redémarrer ses conteneurs et donc resceller
Vault. Le script le détecte, refuse de déclarer la maintenance réussie et exige
le déverrouillage opérateur avant la vérification du backend et du bot. Il ne
charge jamais automatiquement la clé de déverrouillage.

Après leur réussite, `.secrets/vault/stateful.prod.env` fige les images,
volumes, points de montage et hostname effectivement promus. Les scripts de
déploiement, de sauvegarde et de rotation RabbitMQ chargent automatiquement ce
fichier root-only ainsi que les deux overlays `ops/stateful`. Une opération
future ne peut donc pas réintroduire les anciens services stateful du Compose
historique.

La rotation du mot de passe du compte RabbitMQ existant est coordonnée avec les
deux chemins Vault par `rotate-rabbitmq-password.sh`. Le secret est généré sur
le VPS, n'est jamais affiché et l'ancien état est restauré automatiquement si
la recréation ou les contrôles du backend/bot échouent.

## Catalogue ressources V33

La release ressources regroupe les anciennes migrations de développement V33 à V37 dans `V33__resources_catalogue.sql`. La production reste en V32 avant promotion et applique une seule migration transactionnelle PostgreSQL. Le précontrôle accepte V32 ou V33 ; le contrôle runtime vérifie V1–V33 et les structures ressources.

Le staging anciennement V37 fait l’objet d’une réconciliation explicite et sauvegardée de son historique ; cette opération est interdite sur la production. La base de développement V32 migre normalement. Aucun `repair` aveugle ni suppression de données métier.

## Réponses Discord : clé du bot et ordre de déploiement

Un clic sur Présent, Peut-être ou Absent d'un événement classique n'est confirmé au
membre que si le serveur a réellement enregistré sa réponse. Le bot interroge pour cela
le serveur par `POST /api/events/bot/participation`, avec sa clé.

- `BOT_API_KEY` doit être renseignée **à l'identique** pour le backend et pour le bot.
  Sans elle, le bot refuse de démarrer. Vide côté backend (réponse 503) ou différente
  (réponse 401), tous les clics reçoivent un message d'échec : aucune réponse n'est
  enregistrée, et aucun succès n'est annoncé à tort.
- **À contrôler à la main avant une livraison** : le précontrôle de
  `deploy-application-release.sh` ne vérifie pas cette clé, et le `docker-compose.yml`
  qu'il utilise accepte une valeur vide. Seul `vault/configure-production-secrets.sh`
  la contrôle, au moment où les secrets sont posés (32 caractères au moins, identique
  pour le backend et le bot). Les secrets restent sur le serveur ; cette procédure ne
  les modifie pas.
- Ordre obligatoire : **backend, puis bot** — celui que suit déjà
  `deploy-application-release.sh`. Un nouveau bot face à un ancien backend refuse toutes
  les réponses (401). Un ancien bot face au nouveau backend continue de fonctionner par
  RabbitMQ, avec l'ancien défaut de confirmation.
- Les annonces d'opération n'ont pas de bouton de réponse : la présence s'y gère sur la
  fiche. Après l'heure de fin d'une opération publiée, le serveur refuse tout changement
  de présence, par le site comme par le bot.

## Release Opérations et Équipages : Flyway V39 à V43

La production est en V38. Cette release applique cinq migrations au démarrage du backend :
V39 (offres Wikelo par l'API) puis V40 à V43 (module Opérations et équipages).

Le dossier `/root/iceforge/ops/backend-rollout/` du serveur se compose de deux dossiers du
dépôt, qui n'ont aucun nom de fichier en commun :

- `ops/production/backend-rollout/` : fichier Compose, `verify-compose.py`, préparation des
  volumes et vérifications historiques V28 à V32 ;
- `ops/backend-rollout/` : `verify.sh` et les vérifications Flyway en service
  (`verify-flyway-v33.sql`, `verify-flyway-v38-checksums.sql`, `verify-flyway-v43.sql`).

Avant le précontrôle, déposer les quatre fichiers de `ops/backend-rollout/` sur le serveur,
depuis la révision livrée. Le script de déploiement refuse de continuer si `verify.sh` ou
une vérification est une version antérieure à cette release.

| Moment | Contrôle | Refus |
|---|---|---|
| Précontrôle (`--preflight`), base en V38 | `verify-flyway-v33.sql` : historique exact V1 à V38 et structure | Autre version, migration en échec |
| Précontrôle, base en V38 | `verify-flyway-v38-checksums.sql` : scripts et checksums V31 à V38 | Historique différent de celui livré |
| Précontrôle, base déjà en V43 | `verify-flyway-v43.sql` | Release incomplète |
| Après démarrage du backend | `verify.sh runtime`, version V43 exigée, puis `verify-flyway-v43.sql` | Base restée en V38, checksum V31 à V43 différent, structure Wikelo ou Opérations incomplète |

Une base en V39, V40, V41 ou V42 est refusée : c'est une migration interrompue, à analyser
avant toute reprise. Aucun `flyway repair` n'est prévu.

**Retour arrière.** V39 supprime la colonne `source_sheet`, que l'ancien backend lit : il
ne démarre plus sur la base migrée (« missing column [source_sheet] », vérifié). Le retour
automatique aux trois images précédentes ne suffit donc pas après les migrations. Il faut
restaurer la sauvegarde chiffrée prise par le script, puis remettre les anciennes images.
Le script ne tente donc plus ce retour automatique dès que la version Flyway a changé :
il s'arrête avec ce message et laisse les services en l'état. Avant toute migration, le
retour automatique aux images précédentes reste en place.
Tout ce qui a été saisi entre-temps est perdu : prévoir une fenêtre courte et annoncée.

### Restauration après un échec postérieur aux migrations

À suivre quand le script s'arrête sur « Déploiement en échec après migration », ou quand la
release doit être retirée après coup. Deux éléments sont nécessaires, tous deux produits par
le script avant la bascule :

- l'archive chiffrée `/var/backups/iceforge/iceforge-<horodatage>.tar.gz.age` et son
  fichier `.sha256` ;
- le fichier `/var/backups/iceforge/application-rollback.XXXXXX`, qui consigne les trois
  images en service avant le déploiement. Son chemin est affiché par le message d'arrêt.

L'identité `age` qui déchiffre l'archive ne reste pas sur le serveur : l'apporter pour
l'étape 2 et la retirer ensuite, ou déchiffrer sur le poste d'administration et ne
transférer que le dossier extrait.

1. **Arrêter les écritures.** Le frontend peut rester en place.

   ```bash
   docker stop iceforge_backend iceforge_bot
   ```

2. **Vérifier puis déchiffrer l'archive**, dans un dossier réservé à root.

   ```bash
   (cd /var/backups/iceforge && sha256sum -c iceforge-<horodatage>.tar.gz.age.sha256)
   install -d -m 700 /root/restore
   age -d -i <identité> /var/backups/iceforge/iceforge-<horodatage>.tar.gz.age | tar -xzf - -C /root/restore
   (cd /root/restore/<dossier extrait> && sha256sum -c SHA256SUMS)
   ```

3. **Restaurer dans une base neuve**, à côté de la base migrée, qui n'est pas touchée.

   ```bash
   docker exec -i iceforge_db sh -ceu 'createdb -U "$POSTGRES_USER" -T template0 "${POSTGRES_DB}_restauree"'
   docker exec -i iceforge_db sh -ceu 'pg_restore --exit-on-error -U "$POSTGRES_USER" -d "${POSTGRES_DB}_restauree"' \
     < /root/restore/<dossier extrait>/postgresql.dump
   ```

4. **Contrôler la base restaurée** : la version doit être celle d'avant la release (38).

   ```bash
   docker exec -i iceforge_db sh -ceu 'psql -X -At -U "$POSTGRES_USER" -d "${POSTGRES_DB}_restauree" \
     -c "SELECT max(version::integer) FROM public.flyway_schema_history WHERE success"'
   ```

5. **Échanger les deux bases par renommage.** La base migrée est conservée sous un autre
   nom tant que l'incident n'est pas clos ; aucune donnée n'est supprimée.

   ```bash
   docker exec -i iceforge_db sh -ceu 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
     -c "ALTER DATABASE \"$POSTGRES_DB\" RENAME TO \"${POSTGRES_DB}_migree\"" \
     -c "ALTER DATABASE \"${POSTGRES_DB}_restauree\" RENAME TO \"$POSTGRES_DB\""'
   ```

   Le renommage échoue tant qu'une session est ouverte sur la base : vérifier que le
   backend et le bot sont bien arrêtés.

6. **Remettre les trois anciennes images**, avec la commande Compose du script (tableau
   `compose` de `deploy-application-release.sh`).

   ```bash
   set -a; . /var/backups/iceforge/application-rollback.XXXXXX; set +a
   <commande compose du script> up -d --no-deps --no-build --pull never --wait backend bot frontend
   ```

7. **Vérifier** : `verify.sh runtime` de la révision remise en service, connexion au site,
   journal du backend sans erreur Flyway.

Ce qui a été saisi après la sauvegarde reste dans la base `<nom>_migree` et n'est pas
repris automatiquement.

Cette procédure n'a jamais été exécutée en production. La restauration de ce format de dump
est rejouée en instance isolée à chaque sauvegarde (`ops/backups/verify-postgres-isolated.sh`)
et l'échange par renommage a été répété sur la base de développement le 13 octobre 2026.

## Après déploiement : resynchronisation Wikelo

V39 vide les offres de vaisseaux Wikelo : 35 offres publiées et 36 enregistrements bruts en
production (relevé du 13 octobre 2026). Les recettes d'équipement, les comptes et les
objectifs des membres ne sont pas touchés. Tant que la resynchronisation n'est pas publiée,
la page Wikelo répond normalement et affiche une liste de vaisseaux vide.

La resynchronisation n'est pas automatique : un administrateur la lance et valide des choix.

1. **Lancer.** Page d'administration du catalogue, traitement « Wikelo » (API :
   `POST /api/admin/catalog-sync/scrape-and-map`, portée `WIKELO`). Aucun autre traitement
   de catalogue ne doit être en cours ou en attente : un seul est admis à la fois.
2. **Récupération.** Environ 10 secondes mesurées sur une copie isolée : véhicules et
   missions lus sur l'API Star Citizen Wiki. Le nombre d'offres dépend de la version du jeu
   publiée par l'API ce jour-là (42 lors de l'essai, version 4.10.1) : ce n'est pas une
   valeur attendue.
3. **Choix de correspondance.** Le traitement s'arrête en « attente de validation » quand
   un vaisseau a plusieurs variantes possibles. 8 choix sur la copie de la base de
   développement (Avenger Stalker, cinq Constellation, Skylark) ; 36 sur une base au
   catalogue vide. Le nombre en production dépend de son catalogue : il n'a pas été mesuré.
   Chaque choix se tranche dans la page d'administration ; plusieurs variantes peuvent être
   retenues pour un même nom.
4. **Publication.** Elle part seule quand le dernier choix est enregistré, en quelques
   secondes. Conditions : récupération complète, aucun identifiant de mission en double,
   quantités valides. Sinon rien n'est publié et les offres précédentes restent en place.
5. **Vérifier.**
   - le traitement est « réussi », étape 6 sur 6, sans message d'erreur ;
   - tous les choix de correspondance sont validés : aucun ne reste en attente ;
   - le nombre d'offres publiées est celui annoncé par le traitement (« N offres
     publiées ») et celui rendu par `GET /api/wikelo/ships` ;
   - chaque offre porte une mission, une récompense et la version source du jour ; aucun
     vaisseau n'apparaît deux fois pour la même mission ;
   - `GET /api/wikelo/equipment` répond ;
   - sur la page Wikelo du site, quelques vaisseaux pris au hasard affichent le bon nom,
     leur image et un coût cohérent avec la source.

**Si la synchronisation échoue.** Le traitement passe en échec avec son message ; la liste
reste vide, le reste du site n'est pas affecté. Corriger la cause (API injoignable, réponse
incomplète) puis relancer : un traitement en échec ne bloque pas le suivant. Un traitement
laissé en attente de validation, lui, bloque tout autre traitement de catalogue jusqu'à ce
que ses choix soient faits.

La durée réelle est donc celle de la revue par l'administrateur, pas celle de la machine.
Ne pas lancer ce traitement avant que le contrôle après démarrage ait réussi.
