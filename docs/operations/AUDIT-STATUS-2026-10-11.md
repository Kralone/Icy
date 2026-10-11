# État de l’audit — 11 octobre 2026

Branche contrôlée : `codex/operations-reprise-audit`.

## Validation courante

| Gate | État | Preuve actuelle | Écart restant |
|---|---|---|---|
| 0 — audit et plan | PASS | Matrice atomique, packs et revues indépendantes | Conclusion historique à maintenir comme archive |
| 1 — navigation et interface participant | PARTIEL | CUA calendrier, publication, mobile 390×844, desktop 1280×720 et 4K 3840×2160 sans débordement | Captures riches desktop/mobile et états erreur/chargement à archiver |
| 2 — création, objectifs, aperçu | PARTIEL | Création admin, objectifs JSON, aperçu/publication et tests | Conservation exhaustive du parcours événement historique à compléter |
| 3 — organisation | PARTIEL | Groupes, deux niveaux, modes hérités, réordre et suppression contrôlée | Sélecteur de responsable et preuve runtime avec compte délégué |
| 4 — affectations et capacité | PARTIEL | Verrous feuille/ancêtres, capacités hiérarchiques, tests de scope parent/enfant/frère | Test d’intégration de deux transactions et fixture runtime parent plein |
| 5 — flotte et besoins | PARTIEL | Migration V49, API séparée, éditeur, participant, protection des brouillons, tests, sélecteur catalogue nommé | Association besoin↔appareil fourni et test runtime de bout en bout |
| 6 — non-régression UI | PARTIEL | Build Angular et parcours calendrier/opération exécutés | Revue visuelle indépendante complète des états demandés |
| 7 — Discord et historique | NON VERIFIÉ | Sources et tests existants inspectés | Parcours Discord, synchronisation et migrations historiques à exécuter |

## Vérifications techniques

- Build Docker backend : **276 tests, 0 échec, 3 ignorés**.
- Build Angular de production réussi ; avertissements CSS historiques conservés.
- Services locaux actifs : frontend `127.0.0.1:18088`, backend `127.0.0.1:18080`, PostgreSQL `127.0.0.1:15432`.
- Le bouton de gestion des événements a été retiré du calendrier ; le panneau admin expose `Nouvelle opération` vers `/icy/operations/new`.
- Les besoins d’un brouillon sont invisibles aux participants ; les organisateurs gardent l’accès d’édition.

Cette branche n’est pas prête à être fusionnée dans `main` tant que les écarts P0 des Gates 3–5 et la revue du Gate 7 ne sont pas levés par preuve indépendante.

- L’éditeur des besoins utilise désormais un sélecteur catalogue nommé avec images et une sélection de groupe par libellé ; preuve CUA Aurora du 11/10/2026.

- L’éditeur permet aussi de modifier un besoin existant ; la liste se rafraîchit après sauvegarde.

- L’éditeur Organisation utilise maintenant une arborescence et une fiche de propriétés en deux panneaux desktop, avec empilement mobile sous 760px.
