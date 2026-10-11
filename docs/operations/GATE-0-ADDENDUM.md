# Gate 0 — Addendum d’état courant

Date : 11 octobre 2026.

## Git

- Branche : `codex/operations-reprise-audit`.
- Arbre avant cet addendum : propre après correction du test de propriété du hangar.
- Référence distante locale : `origin/main` non rafraîchie ; aucun push ni merge effectué.
- La source auditée par la revue indépendante est le commit `9206bd2`. Les corrections suivantes sont séparées par leurs commits et ne réécrivent pas cette référence historique.

## Vérifications exécutées

Commande Maven directe, avec Maven 3.9.9 local :

```text
mvn -Denforcer.skip=true -Dtest=OperationShipServiceTest,OperationGroupServiceTest,EventServiceTest test
```

Résultat après correction du constructeur de `OperationShipServiceTest` : **8 tests, 0 échec, 0 erreur**.

La suite complète avec la même distribution Maven a ensuite donné **266 tests, 0 échec, 3 tests ignorés**, avec `BUILD SUCCESS`.

Commande frontend :

```text
node_modules/.bin/ng.cmd build --configuration production
```

Résultat : build Angular terminé ; avertissements CSS de budget existants. Le serveur temporaire de développement a été lancé sur `127.0.0.1:14200`, mais le navigateur intégré a renvoyé `ERR_CONNECTION_TIMED_OUT`; aucune capture n’est donc déclarée.

Docker local observé avec privilèges adaptés : frontend `18088`, backend `18080`, PostgreSQL `15432`, RabbitMQ `15672`, tous les services principaux healthy. Les images en cours sont antérieures aux derniers commits et ne constituent pas une preuve runtime de ces changements.

## Limites restantes

- Pas de capture baseline ou finale desktop/mobile.
- Pas de test E2E navigateur.
- Pas de relecture migration V46/V47 sur base vierge et base historique.
- Les écarts métier des Gates 3 à 7 restent listés dans la matrice atomique.
