# Pack de revue Gate 7 — Discord et historique

## Périmètre

Flux d’activités, embed opération, trois boutons de participation, lien profond, idempotence, synchronisation et migrations historiques.

## Preuves à relire

- `evidence/GATE-7-DISCORD-2026-10-11.txt`.
- `icy/messaging/event_handler.py`.
- `icy/tests/test_event_participation.py`, `test_discord_idempotency.py`, `test_removed_attack_surface.py`.

## Commandes

Exécuter les tests Python du bot dans l’image de validation ; le runtime Discord réel reste opt-in et nécessite un token/salon configurés.

## Limites à contrôler

Ne pas considérer la compilation comme une preuve de synchronisation bidirectionnelle. Vérifier les événements classiques et les opérations séparément.

## Verdict attendu

Revue indépendante technique, règles métier, sécurité, UX Discord et non-régression, avec limitation runtime clairement classée.
