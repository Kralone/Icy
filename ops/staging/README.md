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

Les annonces Discord d'une opération portent un bouton « Consulter l'opération ». Le bot
de staging construit ce lien avec `STAGING_PUBLIC_URL`, par défaut
`http://127.0.0.1:19088` : c'est l'adresse du staging **vue depuis le poste du testeur,
tunnel SSH ouvert**. Sans tunnel, le lien ne s'ouvre pas. `deploy.sh` contrôle cette
adresse avant toute modification et refuse de continuer si ce n'est pas une adresse
locale ; il supprime aussi tout bot laissé par une release précédente, qui garderait
son ancien lien. Le bot ne doit donc être démarré que par `deploy.sh --with-bot`.

Si le tunnel est ouvert sur un autre port local, donner la même valeur à
`STAGING_PUBLIC_URL` dans le fichier d'environnement, puis relancer
`deploy.sh --with-bot` : l'adresse n'est lue qu'à la création du bot.

Le message privé de mot de passe temporaire envoyé par le bot utilise la même adresse.

La redirection de port est interdite par défaut à la clé d'exploitation
(`administratively prohibited`). Elle doit être autorisée par un administrateur avant
tout test dans un navigateur, en la limitant à `127.0.0.1:19088` : voir la procédure
ci-dessous.

### Autoriser le tunnel vers le staging (intervention root)

État relevé le 13 octobre 2026 : pour `iceforge-ops`, sshd applique
`AllowTcpForwarding no`, et la clé porte `restrict`. Les deux niveaux doivent être
ouverts, uniquement vers `127.0.0.1:19088`. Le port du staging reste lié à l'adresse
locale du serveur : rien n'est exposé publiquement.

Ne pas changer dans la même intervention le propriétaire du fichier `authorized_keys` :
une erreur de droits y couperait l'accès d'exploitation en même temps.

1. **Garder une session root ouverte** dans un premier terminal, jusqu'à la fin. Toutes
   les vérifications se font depuis un second terminal.
2. **Sauvegarder** :
   ```bash
   stamp=$(date -u +%Y%m%dT%H%M%SZ)
   cp -a /etc/ssh/sshd_config /etc/ssh/sshd_config.backup-$stamp
   cp -a /etc/ssh/sshd_config.d /etc/ssh/sshd_config.d.backup-$stamp
   cp -a /home/iceforge-ops/.ssh/authorized_keys /home/iceforge-ops/.ssh/authorized_keys.backup-$stamp
   ```
3. **Lire l'existant** avant d'écrire quoi que ce soit :
   ```bash
   grep -rnEi '^\s*(Match|AllowTcpForwarding|PermitOpen|DisableForwarding|Include)' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/
   sshd -T -C user=iceforge-ops,host=$(hostname),addr=127.0.0.1 | grep -Ei '^(allowtcpforwarding|permitopen|gatewayports|disableforwarding)'
   ```
   - Si un bloc `Match User iceforge-ops` existe déjà : le compléter, ne pas en créer un second.
   - Si `DisableForwarding yes` s'applique au compte : il l'emporte sur tout le reste ;
     s'arrêter et revoir la procédure.
   - Un bloc `Match` s'étend jusqu'au `Match` suivant ou à la fin du fichier : le nouveau
     bloc se place en fin de fichier, pour ne capturer aucune directive existante.
4. **Ajouter le bloc**, dans un fichier dédié lu en dernier
   (`/etc/ssh/sshd_config.d/90-iceforge-ops-staging-tunnel.conf`, mode `0600`, root) si la
   directive `Include` du fichier principal couvre ce dossier, sinon en fin de
   `sshd_config` :
   ```
   Match User iceforge-ops
       AllowTcpForwarding local
       PermitOpen 127.0.0.1:19088
       GatewayPorts no
   ```
5. **Tester la syntaxe et le résultat, sans recharger** :
   ```bash
   sshd -t
   sshd -T -C user=iceforge-ops,host=$(hostname),addr=127.0.0.1 | grep -Ei '^(allowtcpforwarding|permitopen|gatewayports)'
   sshd -T -C user=root,host=$(hostname),addr=127.0.0.1 | grep -Ei '^(allowtcpforwarding|permitopen)'
   ```
   Attendu pour `iceforge-ops` : `allowtcpforwarding local`, `permitopen 127.0.0.1:19088`,
   `gatewayports no`. Pour `root` et tout autre compte : valeurs inchangées par rapport à
   l'étape 3. En cas d'écart, retirer le bloc et s'arrêter.
6. **Modifier l'option de la clé**, sur la seule ligne de la clé d'exploitation : ajouter
   `port-forwarding,permitopen="127.0.0.1:19088"` après `restrict`. La ligne devient :
   ```
   expiry-time="AAAAMMJJhhmmss",restrict,port-forwarding,permitopen="127.0.0.1:19088" ssh-ed25519 …
   ```
   Vérifier ensuite `ls -l` (propriétaire et mode inchangés) et `ssh-keygen -lf` sur le fichier.
   Le script de renouvellement conserve ces options.
7. **Recharger** : `systemctl reload sshd`, puis `systemctl is-active sshd`. Les sessions
   ouvertes ne sont pas coupées.
8. **Contrôler une nouvelle connexion**, depuis le poste de travail, sans fermer la session root :
   ```powershell
   ssh -T iceforge-ops@SERVEUR "echo ICEFORGE_SSH_ACCESS_OK"
   ssh -N -L 19088:127.0.0.1:19088 iceforge-ops@SERVEUR
   ```
   Le premier doit répondre comme avant. Avec le second ouvert, `http://127.0.0.1:19088`
   doit afficher le staging. Un tunnel vers un autre port, par exemple
   `-L 15432:127.0.0.1:5432`, doit être refusé (`administratively prohibited`).
9. **Retour arrière**, si un contrôle échoue : restaurer les trois sauvegardes de
   l'étape 2, `sshd -t`, `systemctl reload sshd`, puis revérifier la connexion
   d'exploitation. Ne fermer la session root qu'après ce contrôle.

## Vérification et nettoyage

LibreTranslate est démarré avec le backend, sans port publié sur l’hôte. Les
modèles anglais/français sont conservés dans le volume de staging dédié. Le
premier démarrage peut télécharger les modèles ; le déploiement attend jusqu’à
15 minutes leur disponibilité. Le service est limité à 2 CPU et 2 Gio de RAM.

La publication CIG Watch et son relais Discord sont désactivés par défaut,
y compris si le bot de test est démarré. Leur activation reste explicite dans
le fichier d’environnement externe : `STAGING_CIG_WATCH_PUBLISHING_ENABLED`
et `STAGING_CIG_WATCH_DISCORD_ENABLED`. `STAGING_CIG_WATCH_TRANSLATION_URL`
utilise par défaut `http://libretranslate:5000`. Aucune clé d’API payante n’est
nécessaire pour ce service auto-hébergé. Les fichiers de secrets existants sont
conservés.

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
