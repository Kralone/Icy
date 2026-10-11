# Pack de revue Gate 4 — affectations et capacité

## Périmètre

Affectation libre, validation, capacité hiérarchique, verrouillage transactionnel, transfert et feedback de refus.

## Preuves à relire

- `evidence/GATE-4-POSTGRES-LOCK-2026-10-11.txt`.
- `OperationAssignmentCapacityIntegrationIT` et `OperationCapacityPostgresLockIT`.
- `OperationAssignmentService.java` et `operation-page.component.*`.

## Verdict attendu

Vérifier séparément le verrou PostgreSQL, la concurrence métier, la conservation de l’ancienne affectation et le rendu runtime du groupe complet.
