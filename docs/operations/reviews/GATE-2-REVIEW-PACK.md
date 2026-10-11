# Pack de revue Gate 2 — création et publication

## Périmètre

Création d’une opération, objectifs structurés, organisation, aperçu participant, brouillon et publication explicite.

## Preuves à relire

- `evidence/GATE-1-RUNTIME-2026-10-11.txt` : création réelle, brouillon, publication et navigation.
- `evidence/GATE-2-OBJECTIVES-2026-10-11.txt` : ajout, ordre et persistance JSON des objectifs.
- `evidence/GATE-2-ORGANIZATION-2026-10-11.txt` : mutations d’organisation, aperçu et builds.
- `operation-create.component.*`, `operation-editor.component.*`, `operation-page.component.*`.

## Commandes

`docker compose -p iceforge_dev -f docker-compose.yml -f docker-compose.dev.yml build backend frontend`

## Limites à contrôler

Le parcours historique de création d’événement doit rester inchangé ; l’aperçu doit réutiliser le rendu participant. Vérifier les erreurs de sauvegarde et les champs vides.

## Verdict attendu

Revue indépendante technique, UX, sécurité, règles métier et non-régression ; classer chaque réserve avec une preuve ou une reproduction.
