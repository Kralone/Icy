# Gate 1 — Pack de revue UX

## Références

- Branche : `codex/operations-reprise-audit`
- Dossier UX : [GATE-1-UX.md](../GATE-1-UX.md)
- Références métier : `ICEFORGE_CODEX_OPERATIONS_V1.md` et `ICEFORGE_CODEX_REPRISE_AUDIT_UI_OPERATIONS.md`
- Décision produit sur le parcours : [DECISION-UX-ADMIN-CREATION.md](../DECISION-UX-ADMIN-CREATION.md)
- Gate précédent : [GATE-0-REVIEW-PACK.md](GATE-0-REVIEW-PACK.md)

## Preuves disponibles

- Docker reconstruit avec les sources actuelles ; frontend et backend healthy sur 18088/18080.
- Migrations Flyway 46 et 47 appliquées avec succès, schéma en version 47.
- Capture CUA desktop de `/icy/admin/events` : le bouton de conversion n’est plus présent.
- Capture CUA desktop de `/icy/operations/new` : parcours admin accessible, formulaire et état désactivé vérifiés.
- Capture CUA desktop après enrichissement : aperçu de mission, étapes de progression et briefing borné à 50 000 caractères.
- Build Angular production terminé avec avertissements de budget CSS préexistants.
- Maven complet : 266 tests, 0 échec, 3 ignorés.

## Critères de sortie

- [x] Une entrée admin explicite mène à la création d’opération.
- [x] La création est présentée comme un brouillon ouvrant l’éditeur.
- [x] La gestion des événements ne porte plus l’action de conversion.
- [x] Les captures desktop sont datées et rattachées à une URL testée.
- [ ] Capture mobile dédiée et vérification tactile (non disponible dans cette passe CUA).
- [ ] Revue indépendante technique, UI, sécurité et métier.

## Décision

En attente de la revue indépendante de Gate 1. Ce pack ne déclare pas la conformité finale des Gates 2 à 7.
