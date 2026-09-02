# Amorçage d'un administrateur local

`bootstrap-local-admin.ps1` résout le problème du premier administrateur sans
ajouter de route publique au backend. Il fonctionne uniquement sur les projets
Compose locaux `iceforge_dev` et `iceforge_validation`. Le nom
`iceforge_admin_bootstrap_test` est exclusivement réservé au test automatisé
jetable du script.

Le script :

- demande le mot de passe temporaire sans l'afficher ni le placer dans les
  arguments du processus ;
- le chiffre en BCrypt directement dans PostgreSQL ;
- crée le compte ou réactive le compte local correspondant ;
- attribue le rôle `ADMIN` et exige un changement de mot de passe à la première
  connexion ;
- désactive le compte historique `Kralone` uniquement si son identifiant et son
  hash sont encore exactement ceux de la migration V2 ;
- refuse toute exécution si un autre administrateur actif existe déjà.

```powershell
.\ops\admin\bootstrap-local-admin.ps1 `
  -ProjectName iceforge_dev `
  -Username mon_admin `
  -DiscordId 123456789012345678
```

PowerShell demande une confirmation d'impact en plus du mot de passe. Utilisez
`-WhatIf` pour vérifier la cible et les garde-fous sans modifier la base.

Ce script est volontairement inutilisable en production. Le futur processus de
déploiement devra disposer de son propre amorçage, exécuté seulement après les
sauvegardes de la base et des fichiers persistants.
