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
tentative peut réutiliser pendant deux heures une sauvegarde créée et validée
par ce même processus. Son chemin et son fichier `.sha256` sont revérifiés :

```bash
sudo /root/iceforge/ops/production/deploy-application-release.sh \
  --revision <sha-git> \
  --verified-backup /var/backups/iceforge/iceforge-<horodatage>.tar.gz.age
```

Les migrations de PostgreSQL 15 vers 18 et de RabbitMQ 3 vers 4 sont des
opérations stateful distinctes. Elles ne doivent pas être ajoutées à cette
commande applicative.

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
