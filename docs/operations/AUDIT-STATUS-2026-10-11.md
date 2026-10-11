# État de l’audit — 11 octobre 2026

Branche contrôlée : `codex/operations-reprise-audit`.

## Validation courante

| Gate | État | Preuve actuelle | Écart restant |
|---|---|---|---|
| 0 — audit et plan | PASS | Matrice atomique, packs et revues indépendantes | Conclusion historique à maintenir comme archive |
| 1 — navigation et interface participant | PARTIEL avancé | CUA calendrier, publication, deep-links HTTP 200, retour calendrier, mobile 390×844, desktop 1280×720 et 4K 3840×2160 sans débordement | Captures riches desktop/mobile et états erreur/chargement à archiver |
| 2 — création, objectifs, aperçu | PARTIEL | Création admin, objectifs JSON, aperçu/publication et tests | Conservation exhaustive du parcours événement historique à compléter |
| 3 — organisation | PARTIEL avancé | Groupes, deux niveaux, modes hérités, réordre et suppression contrôlée ; preuve Spring/PostgreSQL d’un responsable autorisé sur sa feuille et refusé sur un frère ; sélecteur nommé CUA avec membres actifs et états de mutation visibles | Rejouer les transitions complètes en UI et archiver les états erreur/chargement |
| 4 — affectations et capacité | PARTIEL — capacité et refus validés | Verrous feuille/ancêtres, test PostgreSQL réel à deux transactions, intégration Spring de deux affectations concurrentes sur un parent capacité 1, capacités hiérarchiques, tests de scope parent/enfant/frère ; fixture runtime authentifiée parent plein et message UI `Groupe complet` après HTTP 400 | Maintenir les tests de concurrence et le retour d’erreur visible |
| 5 — flotte et besoins | PARTIEL — SHP-01/02/06/07/08 validés | Migrations V49/V50, API séparée, contrôle de permission et ownership hangar par tests, liaison besoin↔proposition, contrôle de modèle, retrait propriétaire et indisponibilité organisateur, éditeur, participant, protection des brouillons, sélecteur catalogue nommé ; parcours runtime publié hangar→besoin→carte puis retrait ; marquage admin `UNAVAILABLE` avec retour visible ; requête runtime/DB `owner_assignments = 0` | Maintenir la régression sur la liaison et contrôler SHP-03/04/05 |
| 6 — non-régression UI | PARTIEL | Build Angular et parcours calendrier/opération exécutés | Revue visuelle indépendante complète des états demandés |
| 7 — Discord et historique | PARTIEL | Sources inspectées, suite bot **65 réussis / 7 ignorés**, boutons et lien profond testés | Runtime Discord réel et migrations historiques à exécuter |

## Vérifications techniques

- Build Docker backend : **282 tests, 0 échec, 3 ignorés**.
- Build Angular de production réussi ; avertissements CSS historiques conservés.
- Services locaux actifs : frontend `127.0.0.1:18088`, backend `127.0.0.1:18080`, PostgreSQL `127.0.0.1:15432`.
- Le bouton de gestion des événements a été retiré du calendrier ; le panneau admin expose `Nouvelle opération` vers `/icy/operations/new`.
- Les besoins d’un brouillon sont invisibles aux participants ; les organisateurs gardent l’accès d’édition.

Cette branche n’est pas encore prête à être fusionnée dans `main` tant que les preuves UI/runtime et les revues indépendantes listées dans `reviews/INDEPENDENT-REVIEW-2026-10-11.md` ne sont pas clôturées.

- L’éditeur des besoins utilise désormais un sélecteur catalogue nommé avec images et une sélection de groupe par libellé ; preuve CUA Aurora du 11/10/2026.

- L’éditeur permet aussi de modifier un besoin existant ; la liste se rafraîchit après sauvegarde.

- L’éditeur Organisation utilise maintenant une arborescence et une fiche de propriétés en deux panneaux desktop, avec empilement mobile sous 760px.

## Portée des validations du 11 octobre, 19 h 57

Les avis de `review_step1` et `review_operations_latest` valident la capacité hiérarchique et son refus HTTP/UI, ainsi que SHP-06/07/08. Ils ne prouvent pas toutes les autres exigences des étapes 4 et 5. Les étapes globales restent partielles tant que les lignes GRP non vérifiées et SHP-01 à SHP-05 ne sont pas contrôlées. Le passage provisoire des étapes entières à CONFORME dépassait la portée des preuves.
