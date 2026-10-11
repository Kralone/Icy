# Pack de revue Gate 6 — non-régression UI

## Périmètre

Calendrier commun, événement classique, opération, desktop 1280/4K, mobile 390, états vides/chargement/erreur et accessibilité.

## Preuves à relire

- `evidence/GATE-1-RUNTIME-2026-10-11.txt` : mesures desktop, 4K et mobile.
- `operation-page.component.*` et `events.component.*`.
- Build Angular de production dans les sorties Docker.

## Limites à contrôler

Les avertissements CSS historiques doivent rester non bloquants. Vérifier le clavier, le focus, les boutons désactivés et l’absence de débordement.

## Verdict attendu

Revue visuelle indépendante sur les trois tailles et les états non nominaux, avec captures ou reproduction précises.
