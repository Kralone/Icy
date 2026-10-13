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
