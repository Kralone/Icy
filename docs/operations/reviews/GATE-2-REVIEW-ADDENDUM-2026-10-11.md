# Addendum de revue indépendante — Gate 2

Date : 11 octobre 2026  
Branche : `codex/operations-reprise-audit`  
Commits contrôlés : `fe956b8`, avec la preuve runtime `be55ace`

## Revalidation

Deux relectures indépendantes ont contrôlé les écarts CRT-03 et CRT-05 après les corrections.

| Critère | Verdict | Preuve et limite |
|---|---|---|
| CRT-03 — conservation des données de création | PARTIEL avancé | Le formulaire direct expose titre, type, briefing, dates, image de mission et permission de propositions. CUA a rempli les champs image/permission et constaté un aperçu mis à jour ainsi qu’un bouton actionnable. `CreateEventRequest` et `OperationController` recopient ces valeurs dans le brouillon. Les éventuels champs historiques supplémentaires ne sont pas encore inventoriés ni arbitrés. |
| CRT-05 — reprise après erreur de sauvegarde | CONFORME (PROUVÉ) | Le test composant couvre erreur, conservation du formulaire, second appel et succès. La preuve CUA arrête le backend, observe l’alerte et `Réessayer`, relance le backend, puis observe `Opération enregistrée.`. La vérification mobile et l’accessibilité détaillée restent hors de ce critère ciblé. |

## Verdict Gate 2

Gate 2 reste **CHANGES REQUIRED**. CRT-05 est clôturé ; CRT-03 est amélioré mais reste partiel. Les critères CRT-06 et CRT-07, ainsi que l’arbitrage CRT-02, restent ouverts dans la matrice.

## Relecteurs

- `review_step1` : CRT-03 PARTIEL avancé, CRT-05 CONFORME (PROUVÉ).
- `review_operations_latest` : CRT-05 CONFORME (PROUVÉ), limites identiques sur CRT-03/06/07.
