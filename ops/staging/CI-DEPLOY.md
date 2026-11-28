# Déploiement automatique du staging depuis GitHub Actions

Après chaque merge sur `main` qui touche l'application, la CI construit les trois images
(backend, bot, frontend), les pousse sur GHCR et peut installer la release sur le staging du
VPS. Ce document décrit la mise en place, à faire une seule fois en root. Tant que la variable
de dépôt `STAGING_DEPLOY` ne vaut pas `enabled`, le job `Deploy staging` est sauté et rien
n'est envoyé au VPS.

## Ce que fait le job

1. Il se connecte en SSH avec une clé dédiée au compte `iceforge-ci`. Cette clé est **forcée**
   sur `/usr/local/sbin/iceforge-staging-ci-deploy` (copie de `ops/staging/ci-deploy.sh`
   installée par root) : elle ne peut lancer aucune autre commande, ni ouvrir de tunnel.
2. Le script reçoit la révision Git, les trois digests d'images et, sur l'entrée standard, les
   fichiers de la release (Compose, scripts, fixtures, `release.json`). Il refuse toute autre
   forme d'appel, tout fichier inattendu dans l'archive et tout registre autre que celui fixé
   dans `/etc/iceforge-staging/ci-deploy.conf`.
3. Il tire les images **par digest**, les tague `iceforge/<composant>:<sha>` comme une release
   manuelle, puis lance `install-release.sh --preloaded-images`.
4. Mode `auto` (merge sur `main`) : si le staging tourne, `deploy.sh` recrée les services et
   lance `verify.sh` ; un bot de staging déjà en marche est recréé avec `--with-bot`. Si le
   staging est en veille (`suspend.sh`), la release est seulement installée et le staging reste
   en veille. Le mode `start` (lancement manuel du workflow CI) démarre le staging dans tous les
   cas.

Le script ne connaît que le projet Compose `iceforge_staging`. Il ne lit ni n'écrit la
production, ne fait aucune sauvegarde et ne supprime aucune image.

## Point de vigilance

Le staging tourne sur le même VPS que la production, et Docker donne l'équivalent de root.
Le contenu de la release (Compose et scripts) vient de `main` : **quiconque peut pousser sur
`main` peut faire exécuter du code en root sur le VPS**. C'est déjà le cas aujourd'hui avec
`publish-release.ps1`, mais l'automatisation rend le chemin direct. Avant d'activer :

- protéger `main` (merge par PR uniquement, pas de push forcé) ;
- limiter l'environnement GitHub `staging` à la branche `main` (étape 4 ci-dessous) : les PR,
  forks et Dependabot ne reçoivent jamais la clé.

## Mise en place (root, une fois)

1. **Compte et commande forcée**

   ```bash
   useradd --system --create-home --shell /bin/bash iceforge-ci
   install -o root -g root -m 0755 ops/staging/ci-deploy.sh /usr/local/sbin/iceforge-staging-ci-deploy
   printf 'iceforge-ci ALL=(root) NOPASSWD: /usr/local/sbin/iceforge-staging-ci-deploy\n' \
     >/etc/sudoers.d/iceforge-ci
   chmod 0440 /etc/sudoers.d/iceforge-ci && visudo -cf /etc/sudoers.d/iceforge-ci
   ```

   Le script installé est la référence : une nouvelle version dans le dépôt n'est active
   qu'après une nouvelle copie par root.

2. **Clé SSH dédiée**, générée sur le poste (jamais la clé d'exploitation) :

   ```powershell
   ssh-keygen -t ed25519 -N '""' -C iceforge-ci-staging -f $env:USERPROFILE\.ssh\iceforge_ci_staging
   ```

   Sur le VPS, une seule ligne dans `/home/iceforge-ci/.ssh/authorized_keys` (dossier `0700`,
   fichier `0600`, propriétaire `iceforge-ci`) :

   ```
   restrict,command="sudo -n /usr/local/sbin/iceforge-staging-ci-deploy $SSH_ORIGINAL_COMMAND" ssh-ed25519 AAAA… iceforge-ci-staging
   ```

   Si sshd filtre les comptes (`AllowUsers`, `AllowGroups`), y ajouter `iceforge-ci`, puis
   `sshd -t` et `systemctl reload sshd`, en gardant une session root ouverte.

3. **Registre**

   ```bash
   printf 'IMAGE_PREFIX=ghcr.io/kralone/iceforge-\n' >/etc/iceforge-staging/ci-deploy.conf
   chmod 0600 /etc/iceforge-staging/ci-deploy.conf
   ```

   Les paquets GHCR `iceforge-backend`, `iceforge-bot` et `iceforge-frontend` sont créés
   privés au premier push. Deux possibilités :
   - les passer en **public** (Package settings → Change visibility) : le code est déjà public,
     les images ne contiennent aucun secret, et le VPS n'a besoin d'aucun identifiant ;
   - ou les garder privés et faire, en root sur le VPS, `docker login ghcr.io` avec un jeton
     GitHub limité à `read:packages`.

4. **GitHub** (Settings du dépôt `Kralone/Icy`)
   - Environments → New environment `staging` → Deployment branches : *Selected branches*,
     `main` uniquement.
   - Dans cet environnement :
     - secret `STAGING_SSH_KEY` : contenu de la clé privée `iceforge_ci_staging` ;
     - secret `STAGING_SSH_KNOWN_HOSTS` : sortie de `ssh-keyscan -t ed25519 <serveur>`,
       contrôlée contre `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` sur le VPS ;
     - variable `STAGING_SSH_HOST` : adresse du VPS ;
     - variable `STAGING_SSH_USER` (facultative, `iceforge-ci` par défaut).
   - Variables du dépôt (Actions → Variables) : `STAGING_DEPLOY` = `enabled`.

5. **Premier essai** : Actions → CI → *Run workflow* sur `main`, staging `auto`. Le résumé du
   job `Publish images` liste les digests, et le job `Deploy staging` doit finir par
   `CI-DEPLOY=INSTALLED` (staging en veille) ou `CI-DEPLOY=DEPLOYED`.

## Désactiver

Mettre `STAGING_DEPLOY` à une autre valeur (le job est sauté), ou retirer la ligne de
`authorized_keys` pour couper l'accès côté VPS.
