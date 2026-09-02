# Environnement de développement local

Cette pile persistante utilise le projet Compose `iceforge_dev`. Ses volumes,
réseaux et ports sont distincts de la pile jetable `iceforge_validation` et de
la production.

```powershell
# Premier démarrage avec build et données synthétiques
.\ops\dev\start-dev.ps1 -Build -Seed

# Démarrages suivants (les données sont conservées)
.\ops\dev\start-dev.ps1

# Arrêt sans supprimer les données
.\ops\dev\stop-dev.ps1
```

Le site est disponible sur `http://127.0.0.1:18088`, le backend sur le port
`18080`, PostgreSQL sur `15432` et l'interface RabbitMQ sur `25672`.

Le bot Discord reste désactivé par défaut. `start-dev.ps1 -Bot` ne doit être
utilisé qu'avec un jeton Discord de développement et jamais avec le bot de
production.

Pour créer le premier administrateur local sans réutiliser le compte historique
de la migration V2 :

```powershell
.\ops\admin\bootstrap-local-admin.ps1 `
  -ProjectName iceforge_dev `
  -Username mon_admin `
  -DiscordId 123456789012345678
```

Le script refuse une base contenant déjà un administrateur non hérité et force
le changement du mot de passe temporaire à la première connexion.

La remise à zéro est volontairement explicite et ne cible que `iceforge_dev` :

```powershell
.\ops\dev\reset-dev.ps1 -ConfirmProjectName iceforge_dev
```
