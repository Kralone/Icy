# Gate 0 — Revue indépendante de l’audit

## Référence et portée

Relecteur : tâche indépendante `/root/review_step0`, le 11 octobre 2026. Source auditée : commit `9206bd29836f4db9c043206cfd337226126d3b83`, observé sur `codex/operations-reprise-audit`, avec arbre propre au début de cette relecture. Références : `ICEFORGE_CODEX_OPERATIONS_V1.md` et `ICEFORGE_CODEX_REPRISE_AUDIT_UI_OPERATIONS.md` dans le répertoire Downloads du demandeur, ainsi que `AGENTS.md`.

Cette revue porte sur la fidélité de l’inventaire, la traçabilité des écarts, la baseline et le plan. Elle ne demande pas que les fonctionnalités des Gates 2–7 soient déjà conformes. Un commit documentaire ultérieur n’invalide pas le commit source ci-dessus ; toute correction de code doit simplement porter sa propre preuve de validation.

Les verdicts précédents de cette tâche confondaient trop souvent conformité finale et passage de Gate 0. Leur exigence répétée de faire correspondre le SHA documentaire au dernier commit documentaire était également injustifiée. Le présent document remplace cette interprétation.

## Faits observés

- `git status --short --branch` et `git rev-parse HEAD` confirment la branche dédiée et le commit source. L’ancien blocage « branche impossible à créer » est levé. Les références distantes locales ne prouvent ni la fraîcheur du remote, ni un push, ni les protections de main.
- Le formulaire `event-management.component.html` contient « Transformer en opération ». Son handler appelle `EventService.createOperation` puis ouvre l’éditeur ; un feedback d’erreur est présent. Les affirmations d’absence totale de ce bouton doivent être retirées de la matrice actuelle.
- `OperationController.create` déclare une transaction englobante. `EventService.createEvent` enregistre les diffusions via `TransactionSynchronization.afterCommit`. Cela diffère les effets en cas de rollback ; cela ne démontre pas l’invisibilité d’un brouillon après un commit réussi. Le callback de création ne filtre pas lui-même le statut DRAFT.
- V46 ajoute `allow_ship_proposals BOOLEAN NOT NULL DEFAULT FALSE` ; V47 ajoute `objectives TEXT`. Les champs existent dans les entités, DTO et interfaces. `OperationShipService.propose` contrôle publication, activation des propositions, Présent, propriété du hangar et rattachement à une feuille de la même opération. Ces contrôles ne sont donc plus absents ; leur validation dynamique reste à produire.
- Les objectifs sont actuellement un texte libre ; la participation est désormais exposée dans la page. La présence du code ne prouve pas le fonctionnement complet, le rendu visuel ou les objectifs ordonnés/principaux/secondaires attendus.
- Le test `OperationShipServiceTest` de la source auditée instancie encore le service avec cinq arguments, alors que son constructeur exige aussi `EventParticipationRepository`. Sa fixture laisse les propositions désactivées : même après correction du constructeur, elle doit atteindre effectivement le contrôle de propriété. L’agent principal signale une compilation Maven échouée et une correction en cours ; cette correction n’est pas incluse dans le verdict présent.
- Les rapports Surefire anciens observés ne constituent pas une preuve sur cette source. Le précédent retour silencieux du wrapper Maven avec code zéro ne prouvait pas l’exécution des tests et ne doit pas être décrit comme un succès de suite. Aucun nouveau build n’a été exécuté par ce relecteur.

## Correctifs nécessaires à l’audit

1. Remplacer la matrice agrégée par une ligne par exigence atomique, avec source, fichier/symbole, preuve ou limite, état normalisé, sévérité, action, gate et référence de revue. Les colonnes actuelles et les plages `CRT-01..03` ne respectent pas le §3 du document de reprise. Les statuts `FAIL`/`CONFORME` de la matrice doivent suivre les valeurs prescrites ; « CONFORME (PROUVÉ) » nécessite une preuve. Les plages annoncées totalisent 79 identifiants, mais ce nombre ne remplace pas leurs lignes individuelles.
2. Corriger les contradictions internes : bouton annoncé présent dans l’introduction mais absent dans CRT-01..03 ; brouillon déclaré absent malgré son modèle persistant ; objectifs et permission vaisseaux annoncés manquants malgré leur code. Distinguer « présent par inspection », « partiel » et « comportement prouvé ».
3. Ajouter la baseline visuelle réelle du calendrier, de la fiche événement et des références IceForge, avec chemins et tailles desktop/mobile ; si l’environnement est indisponible, documenter la tentative et la limite précise. Les captures de finition de toutes les futures fonctionnalités appartiennent aux gates correspondantes, pas à Gate 0.
4. Consigner les commandes réellement exécutées, dates, commit testé, échec de compilation actuel et résultats après correction. Établir la baseline historique événements/calendrier/hangar/auth/Discord, ou documenter des vérifications manuelles reproductibles et leur couverture limitée.
5. Fournir un plan numéroté avec dépendances, critères d’acceptation et arrêt/revue pour chaque gate, puis recueillir sa validation explicite avant la reprise de développement. Le pack actuel ne suffit pas à démontrer cette acceptation.
6. Actualiser l’état Git courant dans un addendum, sans réécrire les faits historiques : branche dédiée créée, source auditée fixe, état remote/push/protections non vérifié tant que les preuves manquent. Archiver les retours des relecteurs avec leurs références, plutôt qu’attribuer leurs constats historiques à tout nouveau code.

## Écarts à planifier

| Gate de reprise | Écarts et preuves attendues |
|---|---|
| 1 — UX | Comparaison visuelle IceForge, parcours et maquettes desktop/mobile des trois zones ; validation du plan visuel. |
| 2 — Création | Conservation/reprise sans perte, absence de diffusion des brouillons, publication explicite, tests transaction/rollback et erreurs ; migrations sur données anciennes. |
| 3 — Organisation | Édition/réorganisation, délégations et portée, capacités parent, affectations uniquement aux feuilles et gestion des membres existants. |
| 4 — Affectations | Héritage effectif des modes, capacités sous concurrence, demandes et transferts, présence lors de l’approbation, état et composition visibles. |
| 5 — Hangar | Tests effectifs permission/Présent/propriété, besoins distincts, retrait/indisponibilité, rôles propriétaire/pilote et cartes illustrées. |
| 6 — Participant | Objectifs structurés, composition et situation personnelle, plein écran/4K/mobile, états vides/erreur/chargement, accessibilité et preuves visuelles. |
| 7 — Discord et livraison | Publication et mises à jour après validation, trois boutons, lien permanent, idempotence et non-régression complète ; CI et règles de livraison. |

Ces écarts bloquent la conformité finale ou leur gate de réalisation. Leur existence ne bloque pas à elle seule un audit initial fidèle et un plan accepté.

## Verdict Gate 0

| Axe de l’audit | Verdict | Motif |
|---|---|---|
| Technique | FAIL | Inventaire utile mais matrice non atomique, baseline de compilation à corriger et résultats non consolidés. |
| UI/UX desktop | NON VÉRIFIÉ | Captures baseline et comparaison visuelle absentes du pack examiné. |
| UI/UX mobile | NON VÉRIFIÉ | Baseline mobile non documentée. |
| Sécurité | FAIL | Audit à actualiser pour distinguer contrôles présents, risques identifiés et tests restant aux gates suivantes. |
| Règles métier | FAIL | Matrice contradictoire et écarts non reliés individuellement aux preuves/étapes. |
| Non-régression | NON VÉRIFIÉ | Aucun résultat courant consolidé ; test non compilable au commit source. |

**Gate 0 : CHANGES REQUIRED.** Compléter et corriger le dossier d’audit, documenter la baseline et faire accepter le plan. Aucune exigence de terminer les Gates 2–7 avant cette revalidation. Aucun PASS global, build réussi ou validation visuelle n’est annoncé par cette revue.

Seul ce document a été créé par le relecteur ; aucun fichier de code n’a été modifié.
