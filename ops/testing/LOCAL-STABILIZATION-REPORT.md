# Rapport de stabilisation locale

Date de la campagne : 2 septembre 2026

Branche : `codex/local-stabilization`

## Verdict actuel

La version locale est un candidat de validation stable, mais elle n'est pas encore
déclarée prête pour la production. Les piles `iceforge_validation` (jetable) et
`iceforge_dev` (persistante) sont séparées, saines et utilisent uniquement des
données synthétiques.

## Preuves exécutées

| Surface | Résultat | Portée |
|---|---:|---|
| Backend | 144/144 | tests Maven/Java 25 pendant la construction de l'image |
| Frontend unitaire | 58/58 | composants, services, routes, hangar et isolation WebSocket par utilisateur |
| Frontend/API | 85/85 | routes, rôles, refus, redirections, cache et PWA via Nginx |
| Bot | 49/49 | tests Python, backend réel, RabbitMQ réel, retry, DLQ et déduplication |
| Dépendances bot | OK | `pip-audit` : aucune vulnérabilité connue |
| Dépendances frontend prod | Accepté | 0 critique/élevée, 3 modérées transitives via Express 4 / `qs` |
| Reverse proxy | OK | proxy exact en `/32`, en-têtes forgés ignorés, réponse 429 |
| Navigateur | OK | connexion ADMIN, dashboard peuplé, accès admin et SCWE |
| Compose | OK | configurations validation, développement et production résolues |
| Intégrité du diff | OK | `git diff --check` sans erreur |

Les comptes synthétiques sont `validation_user`, `validation_officier` et
`validation_admin`, avec le mot de passe local `password`. Ils ne doivent jamais
être repris en production.

La suppression des trois avis frontend modérés impose une migration majeure
vers Express 5. Elle est isolée de cette stabilisation afin de ne pas introduire
un changement SSR risqué juste avant la campagne de sortie ; elle devra être
suivie de nouveaux tests SSR et d'hydratation.

## Correctifs principaux inclus

- contrôles d'autorisation explicites et authentification API dédiée au bot ;
- émissions STOMP client refusées et flotte inter-utilisateur limitée aux
  participants confirmés de l'événement, sans Discord ID exposé ;
- CORS, WebSocket, réponses 403 et gestion des tokens durcis ;
- limitation des routes publiques sensibles avec confiance proxy stricte ;
- client HTTP du bot sécurisé et suppression d'anciens endpoints non authentifiés ;
- files RabbitMQ durables, retry borné et DLQ ;
- reconnexion WebSocket frontend et fin de la boucle de déconnexion sur 403 ;
- déduplication du hangar par `shipId` lors du chargement et des événements
  WebSocket redélivrés ;
- politique canonique des routes, cache API/PWA et pages privées durcis ;
- amorçage transactionnel du premier administrateur, réservé aux piles locales,
  avec BCrypt et changement de mot de passe obligatoire ;
- V29 immuable neutralisant uniquement le seed admin V2 exact, avec test complet
  baseline V1 → V29 et contrôles de continuité admin préparés pour la production ;
- fixtures reproductibles couvrant rôles, utilisateurs, vaisseaux, items,
  objectifs, événements, SCWE, actualités, collection, vente et cargo.

## Bloquants avant production

1. Répéter V29 sur une copie restaurée de production, vérifier qu'un autre admin
   actif existe et fixer `FLYWAY_BASELINE_ON_MIGRATE=false` sur cet environnement
   déjà versionné.
2. Tester un bot Discord de développement réel ; aucun token de production n'a été
   utilisé pendant cette campagne.
3. Effectuer et vérifier une sauvegarde/restauration complète de la base et de tous
   les volumes de données avant toute opération sur la production.

Le registre persistant du bot empêche maintenant le doublon connu lorsque Discord
réussit mais que le callback backend échoue. Les URL inconnues servent la page
Angular conviviale avec un vrai statut HTTP 404. Le rate limiting en mémoire est
adapté au déploiement actuel à une seule instance backend ; un stockage partagé ne
sera nécessaire qu'en cas de mise à l'échelle.

Le script `ops/admin/bootstrap-local-admin.ps1` permet de créer un premier admin
local sain. Le test automatisé prouve la migration d'une base V1 non vide jusqu'à
V29, la neutralisation exacte du seed et la création de l'admin. Le script reste
volontairement inutilisable en production.

## Rejouer la validation

```powershell
.\ops\testing\verify-rate-limit-proxy.ps1
.\ops\testing\seed-validation.ps1
.\ops\testing\test-validation-api.ps1
.\ops\testing\test-bot-integration.ps1
.\ops\testing\test-admin-bootstrap.ps1
```

La matrice détaillée d'autorisation est dans
`BACKEND-API-AUTHORIZATION-MATRIX.md`. Les limites publiques et leur modèle de
confiance sont décrits dans `BACKEND-RATE-LIMITING.md`.
