# État de l’audit — 11 octobre 2026

Branche contrôlée : `codex/operations-reprise-audit`.

## Validation courante

| Gate | État | Preuve actuelle | Écart restant |
|---|---|---|---|
| 0 — audit et plan | PASS | Matrice atomique, packs et revues indépendantes | Conclusion historique à maintenir comme archive |
| 1 — navigation et interface participant | PARTIEL | CUA calendrier, publication, mobile 390×844, desktop 1280×720 et 4K 3840×2160 sans débordement | Captures riches desktop/mobile et états erreur/chargement à archiver |
| 2 — création, objectifs, aperçu | PARTIEL | Création admin, objectifs JSON, aperçu/publication et tests | Conservation exhaustive du parcours événement historique à compléter |
| 3 — organisation | PARTIEL avancé | Groupes, deux niveaux, modes hérités, réordre et suppression contrôlée ; preuve Spring/PostgreSQL d’un responsable autorisé sur sa feuille et refusé sur un frère | Revue UI complète du sélecteur de responsable et états de mutation |
| 4 — affectations et capacité | PARTIEL avancé | Verrous feuille/ancêtres, test PostgreSQL réel à deux transactions, intégration Spring de deux affectations concurrentes sur un parent capacité 1, capacités hiérarchiques, tests de scope parent/enfant/frère ; fixture runtime authentifiée parent plein et exception serveur `Groupe complet` reproduites | Corriger le rendu final du refus : l’écran reste sur « Vérification de la capacité… » |
| 5 — flotte et besoins | PARTIEL avancé | Migrations V49/V50, API séparée, liaison besoin↔proposition, contrôle de modèle, retrait propriétaire et indisponibilité organisateur, éditeur, participant, protection des brouillons, tests, sélecteur catalogue nommé ; parcours runtime publié hangar→besoin→carte puis retrait ; marquage admin `UNAVAILABLE` avec retour visible | Vérifier explicitement qu’une même proposition liée ne crée pas de seconde affectation dans le parcours runtime |
| 6 — non-régression UI | PARTIEL | Build Angular et parcours calendrier/opération exécutés | Revue visuelle indépendante complète des états demandés |
| 7 — Discord et historique | PARTIEL | Sources inspectées, suite bot **65 réussis / 7 ignorés**, boutons et lien profond testés | Runtime Discord réel et migrations historiques à exécuter |

## Vérifications techniques

- Build Docker backend : **280 tests, 0 échec, 3 ignorés**.
- Build Angular de production réussi ; avertissements CSS historiques conservés.
- Services locaux actifs : frontend `127.0.0.1:18088`, backend `127.0.0.1:18080`, PostgreSQL `127.0.0.1:15432`.
- Le bouton de gestion des événements a été retiré du calendrier ; le panneau admin expose `Nouvelle opération` vers `/icy/operations/new`.
- Les besoins d’un brouillon sont invisibles aux participants ; les organisateurs gardent l’accès d’édition.

Cette branche n’est pas encore prête à être fusionnée dans `main` tant que les preuves UI/runtime et les revues indépendantes listées dans `reviews/INDEPENDENT-REVIEW-2026-10-11.md` ne sont pas clôturées.

- L’éditeur des besoins utilise désormais un sélecteur catalogue nommé avec images et une sélection de groupe par libellé ; preuve CUA Aurora du 11/10/2026.

- L’éditeur permet aussi de modifier un besoin existant ; la liste se rafraîchit après sauvegarde.

- L’éditeur Organisation utilise maintenant une arborescence et une fiche de propriétés en deux panneaux desktop, avec empilement mobile sous 760px.
