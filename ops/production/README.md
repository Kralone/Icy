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
