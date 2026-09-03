# Préproduction isolée

Cette pile déploie le candidat IceForge sur le VPS sans modifier la production.
Elle utilise le projet Compose `iceforge_staging`, des volumes et réseaux dédiés,
et publie le frontend uniquement sur `127.0.0.1:19088`. PostgreSQL, RabbitMQ et
le backend ne publient aucun port.

Le bot Discord est un profil opt-in. Il ne démarre jamais sans
`--with-bot`, un token temporaire et l'identifiant du serveur Discord de test.
Ne jamais réutiliser le token, le serveur ou les salons de production.

## Installation d'une release

Chaque release immuable vit sous `/opt/iceforge-staging/releases/<sha-git>` et
contient le Compose, les scripts et les fixtures. Les secrets restent dans
`/etc/iceforge-staging/staging.env`, mode `0600`, hors des releases.

`install-release.sh` vérifie le SHA-256 de l'archive Docker, charge les trois
images taguées avec la révision Git et met à jour atomiquement leurs références
dans le fichier d'environnement. Charger une release et la démarrer restent
deux opérations distinctes.

Depuis Windows, `package-release.ps1` refuse un dépôt sale, construit les trois
images avec le SHA Git, puis produit une archive et son manifeste. Le script
`publish-release.ps1` revérifie son empreinte, transfère la release et l'installe
sans démarrer de service. Le démarrage reste une décision explicite via
`deploy.sh`.

```bash
sudo /opt/iceforge-staging/releases/<sha>/prepare-env.sh
sudoedit /etc/iceforge-staging/staging.env
sudo /opt/iceforge-staging/releases/<sha>/deploy.sh \
  --release-dir /opt/iceforge-staging/releases/<sha> --seed
```

Après création du bot Discord temporaire, renseigner uniquement les variables
`STAGING_DISCORD_*` avec le configurateur interactif. Le token est saisi masqué
et n'apparaît ni dans les arguments du processus ni dans les logs :

```bash
sudo /opt/iceforge-staging/current/configure-discord.sh
```

Avec la clé SSH d'exploitation restrictive (sans pseudo-terminal), lancer
plutôt depuis PowerShell :

```powershell
.\ops\staging\configure-discord-from-windows.ps1 `
  -Server SERVEUR `
  -IdentityFile "$env:USERPROFILE\.ssh\iceforge_ops_ed25519"
```

Le script PowerShell demande uniquement le token avec `SecureString`, utilise
les identifiants du serveur et du salon Discord temporaire dédiés, normalise les
fins de ligne Windows, puis transmet le tout sur l'entrée standard SSH. Le token
n'est jamais placé dans les arguments du processus.

Puis démarrer le profil Discord :

```bash
sudo /opt/iceforge-staging/current/deploy.sh \
  --release-dir "$(readlink -f /opt/iceforge-staging/current)" --with-bot
```

Accès depuis le PC par tunnel SSH, uniquement après avoir autorisé une
redirection limitée à `127.0.0.1:19088` pour la clé d'exploitation :

```powershell
ssh -N -L 19088:127.0.0.1:19088 iceforge-ops@SERVEUR
```

Le navigateur peut alors ouvrir `http://127.0.0.1:19088`.

## Vérification et nettoyage

```bash
sudo /opt/iceforge-staging/current/verify.sh \
  --release-dir "$(readlink -f /opt/iceforge-staging/current)"
sudo /opt/iceforge-staging/current/verify-discord-e2e.sh
sudo /opt/iceforge-staging/current/destroy.sh
```

Le test Discord crée un événement synthétique, attend sa publication, republie
le même message AMQP pour prouver la déduplication, vérifie la mise à jour puis
la suppression du message et confirme le nettoyage en base et dans le ledger du
bot. Le scénario possède un nettoyage de secours en cas d'échec.

`destroy.sh` supprime explicitement les conteneurs, réseaux et volumes de
staging. Il ne touche ni à la pile `iceforge`, ni aux sauvegardes, ni aux
releases. La promotion en production reste une opération séparée, précédée
d'une nouvelle sauvegarde complète et d'un test de restauration.
