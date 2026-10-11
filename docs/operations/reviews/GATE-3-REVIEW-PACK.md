# Pack de revue Gate 3 — organisation et délégation

## Périmètre

Arbre à deux niveaux, capacités, modes hérités, réordre, suppression, responsable délégué et portée d’autorisation.

## Preuves à relire

- `evidence/GATE-2-ORGANIZATION-2026-10-11.txt`.
- `evidence/GATE-2-DELEGATION-2026-10-11.txt`.
- `OperationAssignmentCapacityIntegrationIT` : concurrence et délégation Spring/PostgreSQL.
- `OperationAssignmentServiceTest` et `OperationGroupServiceTest`.

## Commandes

`docker run --rm --network iceforge_dev_internal ... -Diceforge.integration=true -Dtest=OperationAssignmentCapacityIntegrationIT test`

## Limites à contrôler

Un responsable d’un parent couvre ses descendants ; un responsable d’une feuille ne couvre pas un frère. Vérifier les transitions d’affectation et les capacités parent/enfant.

## Verdict attendu

Revue indépendante technique, UX, sécurité, règles métier et non-régression.
