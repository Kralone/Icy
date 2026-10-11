# Addendum de revue indépendante — Gate 2

Date : 11 octobre 2026  
Branche : `codex/operations-reprise-audit`  
Commits contrôlés : `fe956b8`, avec la preuve runtime `be55ace`

## Revalidation

Deux relectures indépendantes ont contrôlé les écarts CRT-03 et CRT-05 après les corrections.

| Critère | Verdict | Preuve et limite |
|---|---|---|
| CRT-03 — conservation des données de création | CONFORME (PROUVÉ) sur le parcours direct | Le périmètre direct est accepté par `DECISION-UX-ADMIN-CREATION.md`. L’inventaire de `event-management` couvre titre, type, description/briefing, début, fin et image du type ; CUA a aussi rempli image de mission et permission de propositions. `CreateEventRequest` et `OperationController` recopient ces valeurs dans le brouillon. La conversion historique reste suivie séparément par CRT-02. |
| CRT-05 — reprise après erreur de sauvegarde | CONFORME (PROUVÉ) | Le test composant couvre erreur, conservation du formulaire, second appel et succès. La preuve CUA arrête le backend, observe l’alerte et `Réessayer`, relance le backend, puis observe `Opération enregistrée.`. La vérification mobile et l’accessibilité détaillée restent hors de ce critère ciblé. |

## Verdict Gate 2

Gate 2 reste **CHANGES REQUIRED**. CRT-03 et CRT-05 sont clôturés sur le périmètre direct ; les critères CRT-06 et CRT-07, ainsi que CRT-02 (conversion historique retirée), restent ouverts dans la matrice.

## Relecteurs

- `review_step1` : revalidation initiale CRT-03 PARTIEL avancé puis examen du périmètre direct ; CRT-05 CONFORME (PROUVÉ).
- `review_operations_latest` : CRT-05 CONFORME (PROUVÉ), CRT-03 conforme dès lors que la décision produit limite explicitement le critère au parcours direct.
