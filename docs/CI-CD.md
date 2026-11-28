# CI/CD

## Mesure de départ (28 novembre 2026)

Relevé sur les runs CI de `main` et des PR du 27 et 28 novembre :

| Job | Durée | Ce qui est refait à chaque run |
| --- | --- | --- |
| Backend (Maven) | 60 à 77 s | rien d'anormal : dépôt Maven en cache |
| Frontend (Angular) | 51 à 56 s | rien d'anormal : cache npm |
| Bot (Python) | 17 à 24 s | rien d'anormal : cache pip |
| Compose config | 8 à 16 s | — |
| Smoke test Compose | 147 à 326 s, dont 138 à 315 s de `docker compose up --build` | les trois images reconstruites sans cache : téléchargement de toutes les dépendances Maven, `npm ci`, build Angular, et **une seconde exécution des tests Java** dans l'image backend |
| Security, image-scan | 251 s, dont 139 s de build | les cinq images reconstruites une nouvelle fois, sans cache |

Le smoke test attendait aussi la fin des quatre premiers jobs (environ 1 min) avant de
commencer. Le chemin critique d'un run CI était donc d'environ 6 min 30 à 7 min, et chaque
run, même pour un changement de documentation, lançait tous les jobs.

Côté livraison, les images sont construites sur le poste Windows (`package-release.ps1`),
exportées en archive `docker save`, copiées par `scp` puis chargées sur le VPS
(`publish-release.ps1`, `install-release.sh`) ; `deploy.sh` est lancé à la main ensuite. La
production attend des images `iceforge/<composant>:<sha>` déjà présentes sur le VPS.

## Ce qui change

- **Jobs sautés selon les chemins** (`dorny/paths-filter`) : backend, frontend, bot, Compose
  et smoke test ne tournent que si leur partie change. Un job sauté compte comme réussi. Toute
  modification de `ci.yml` relance tout, ainsi qu'un lancement manuel.
- **Smoke test en parallèle** des tests, plus derrière eux.
- **Cache de couches Docker** (BuildKit, cache GitHub Actions) via `docker-bake.hcl`, partagé
  par le smoke test, la publication et le scan d'images : les dépendances Maven et npm ne sont
  retéléchargées que si `pom.xml` ou `package-lock.json` changent.
- **Tests Java non relancés dans l'image** en CI (`SKIP_TESTS=true`) : le job backend les a
  déjà passés sur la même révision, et la publication exige sa réussite. En local, le
  Dockerfile lance toujours les tests.
- **Correctifs système toujours appliqués** : l'argument `OS_PACKAGES_REFRESH` (date du jour en
  CI) invalide chaque jour la couche `apk upgrade`, que le cache figerait sinon.
- **Annulation limitée aux PR** : sur `main`, un merge ne coupe plus la publication ou le
  déploiement du merge précédent.
- Actions : celles déjà en place étaient à jour (Dependabot). Les nouvelles (`docker/*`,
  `dorny/paths-filter`, `upload-artifact` v7, `download-artifact` v8) sont prises à leur
  dernière version et épinglées par SHA comme les autres.

## Livraison

Sur `main`, après la réussite des tests et du smoke test :

1. **Publish images** : `backend`, `bot` et `frontend` sont poussées sur
   `ghcr.io/kralone/iceforge-<composant>:<sha>`. Les digests sont affichés dans le résumé du
   run, et un artefact `staging-release-<sha>` contient les fichiers de release et
   `release.json` (références par digest).
2. **Deploy staging** : désactivé tant que la variable `STAGING_DEPLOY` ne vaut pas `enabled`.
   Mise en place et garde-fous : [ops/staging/CI-DEPLOY.md](../ops/staging/CI-DEPLOY.md).

`package-release.ps1` et `publish-release.ps1` restent utilisables à la main.

## Proposition : production (non implémentée)

Objectif : livrer en production exactement les images validées sur le staging, sans les
reconstruire, sur décision explicite de Florian.

- Un workflow `deploy-production.yml`, déclenché **uniquement à la main**
  (`workflow_dispatch`, champ : la révision déjà publiée), jamais par un push.
- Environnement GitHub `production` avec **Florian comme approbateur obligatoire** et branche
  `main` seule : le job attend son clic dans GitHub avant de recevoir la moindre clé.
- Une clé SSH distincte de celle du staging, forcée sur un script root dédié, sur le modèle de
  `ci-deploy.sh`, qui :
  1. tire les trois images par digest depuis GHCR et les tague `iceforge/<composant>:<sha>`
     (les tags attendus par `deploy-application-release.sh`) ;
  2. lance `deploy-application-release.sh --revision <sha> --age-recipient <destinataire>
     --preflight`, puis le déploiement si le précontrôle est bon.
- Sauvegarde : le script de production applique déjà la règle du projet. Une archive valide de
  moins de 48 h (et postérieure à la dernière migration) est réutilisée, sans nouvelle
  sauvegarde. Le workflow ne passe jamais `--fresh-backup`.
- Le retour arrière reste celui du script (images précédentes avant migration, restauration
  après migration).

Avant de l'écrire, il faut décider : le destinataire `age` à mettre dans le workflow (public,
donc sans risque), et si l'on accepte qu'une approbation GitHub suffise à lancer une
migration Flyway destructive, ou si ces releases restent manuelles en SSH.
