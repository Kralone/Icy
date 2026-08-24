# Migration Vault 1.17.6 vers 2.x

Ce runbook prépare la montée de l'instance Vault Raft d'IceForge. Vault est un
service avec état : changer uniquement le tag de l'image ne constitue ni une
migration sûre ni un rollback.

## État et cible

- source déclarée : Vault Community 1.17.6, image
  `sha256:74a4ab138ab5d64725e89cd9a9c73f7040c7fe49e98b71697b275ca9a69919df` ;
- stockage : Integrated Storage/Raft dans `/vault/data` ;
- clients IceForge : authentification AppRole et lecture KV v2 sur des chemins
  canoniques `/v1/<mount>/data/<path>` ;
- candidate intermédiaire rejetée : Vault Community 1.21.4, image
  `sha256:4e33b126a59c0c333b76fb4e894722462659a6bec7c48c9ee8cea56fccfd2569` ;
- dernière candidate testée : Vault Community 2.0.4, image
  `sha256:5be49781ecf78bfe775c5309c6a4d9f4e9e040b6c885c99eb2b12fb69855e1a2`.

Les trois images ont été rescannées avec Trivy 0.74.0 et la même base CVE le
24 août 2026 :

| Version | OS HIGH/CRITICAL | Binaire Go HIGH/CRITICAL | Corrigibles | Décision |
|---|---:|---:|---:|---|
| 1.17.6 | 24 / 2 | 55 / 2 | 80 sur 83 | production actuelle à isoler |
| 1.21.4 | 18 / 2 | 48 / 3 | 65 sur 71 | NO-GO |
| 2.0.4 | 0 / 0 | 8 / 0 | 8 sur 8 | NO-GO, meilleure candidate |

Le palier 1.21.4 n'est donc pas une réduction suffisante du risque : il conserve
deux vulnérabilités critiques OS et en ajoute trois dans le binaire Go. La
candidate 2.0.4 est nettement meilleure, mais ses huit vulnérabilités HIGH ont
toutes un correctif disponible. Attendre une image Community ultérieure
construite au minimum avec Go 1.26.6, l'épingler par digest et obtenir un scan
strict à zéro avant de modifier Compose.

L'image 1.17.6 actuelle reste la plus exposée et Alpine 3.20 est en fin de
support. Cela rend urgents le cloisonnement réseau, TLS et les snapshots, mais ne
justifie pas de fusionner une candidate dont les correctifs disponibles ne sont
pas encore intégrés.

## Préparation et go/no-go

Avant toute intervention réelle :

1. confirmer la version, l'édition, le nombre de nœuds, le leader Raft, les pairs
   et l'état Autopilot ;
2. inventorier sans lire les valeurs : méthodes d'authentification, moteurs de
   secrets, plugins, politiques, audits, leases, seals et éventuelle réplication ;
3. vérifier que les chemins clients sont nettoyés et que les politiques
   `allowed_parameters`/`denied_parameters` restent correctes avec la comparaison
   élément par élément de Vault 2 ;
4. vérifier l'absence de fonctionnalité dépréciée ou supprimée et de clé RSA de
   plus de 8192 bits ;
5. réunir le quorum de clés d'unseal ou confirmer l'auto-unseal ;
6. produire un snapshot Raft et son checksum, puis le copier chiffré hors de
   l'hôte ;
7. restaurer ce snapshot dans une instance isolée sans accès aux fournisseurs de
   secrets externes ;
8. conserver l'image, la configuration et un volume vierge compatibles 1.17.6
   pour le rollback.

Le go est interdit sans snapshot restauré, clés d'unseal disponibles, inventaire
des changements 1.18, 1.19, 1.20, 1.21 et 2.0, scan de l'image cible au vert et
validation AppRole/KV des deux applications.

## Migration du runtime Docker

Vault 2.x s'exécute avec l'utilisateur `vault` (`100:1000`). L'instance 1.17.6
Compose s'exécute actuellement en root. Après sauvegarde et sur une copie de
volume, ajuster récursivement le propriétaire de `/vault/data` vers `100:1000`
avant le premier démarrage 2.x. Vérifier les permissions effectives au lieu de
supposer que le driver de volume accepte `chown`.

Conserver l'entrypoint explicite `vault` avec
`server -config=/vault/config/vault.hcl`. L'entrypoint générique de l'image 2.x
ajoute déjà `-config=/vault/config` lorsque la commande commence par `server` ;
lui fournir simultanément le fichier explicite charge deux fois le listener et
provoque `bind: address already in use`.

La configuration IceForge a `disable_mlock = true`. La candidate 2.0.4 démarre
donc sans `IPC_LOCK`. Garder la mémoire swap désactivée ou chiffrée et revoir ce
choix avant la production.

## Validation après montée

Après démarrage et unseal de la cible :

1. vérifier version, seal, leader, pairs Raft et Autopilot ;
2. comparer méthodes d'authentification, moteurs, politiques, plugins et audits ;
3. lire et écrire une sentinelle KV v2 avec un token de test ;
4. obtenir un token par chaque rôle AppRole IceForge, puis vérifier ses politiques
   et son TTL sans afficher le token ;
5. démarrer le backend puis le bot avec leurs identifiants temporaires et contrôler
   leur fail-fast ;
6. redémarrer Vault, refaire l'unseal et vérifier la persistance ;
7. produire un snapshot post-upgrade et son checksum ;
8. surveiller erreurs, seals, renouvellements, latence et échecs d'autorisation
   pendant la fenêtre d'observation.

## Rollback

Vault ne garantit pas qu'un stockage ouvert par une version plus récente puisse
être relu après simple downgrade du binaire. Ne jamais redémarrer 1.17.6 sur le
volume migré.

Pour revenir en arrière : arrêter les clients et Vault 2.x, démarrer Vault 1.17.6
sur un volume vierge, l'initialiser temporairement, restaurer avec `-force` le
snapshot pré-upgrade, puis l'unseal avec les clés de la source restaurée. Vérifier
KV, AppRole et tokens avant de reconnecter les applications. Conserver le volume
2.x intact pour l'analyse.

## Résultat de la répétition locale

Le 24 août 2026, une instance Raft 1.17.6 synthétique a reçu une sentinelle KV v2
et un rôle AppRole, puis a produit un snapshot avec checksum. Une copie du volume
a été réattribuée à l'UID/GID `100:1000` et ouverte directement par Vault 2.0.4.
La donnée KV, AppRole, la création et la vérification d'un token, le snapshot
post-upgrade et la persistance après redémarrage ont réussi.

Le rollback a été prouvé séparément : une instance 1.17.6 sur volume neuf a
restauré avec `-force` le snapshot pré-upgrade, puis a retrouvé la sentinelle KV
et AppRole après unseal avec les anciennes clés. Aucun volume local ou de
production n'a été lu ou modifié pendant cette répétition.

## Références officielles

- [procédure de mise à niveau Vault](https://developer.hashicorp.com/vault/docs/upgrade) ;
- [mises à niveau et rollback des déploiements Raft](https://developer.hashicorp.com/vault/docs/upgrade/replicated-deployment) ;
- [changements importants Vault 2.x](https://developer.hashicorp.com/vault/docs/updates/important-changes) ;
- [notes de version Vault 2.x](https://developer.hashicorp.com/vault/docs/updates/release-notes).
