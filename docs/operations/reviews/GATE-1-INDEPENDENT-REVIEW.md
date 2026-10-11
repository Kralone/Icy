# Revue indépendante Gate 1

Date : 11 octobre 2026  
Commit examiné : `26b8895`  
Branche : `codex/operations-reprise-audit`

## Décision

**BLOCKED — Gate 1 non validée.**

Le dossier apporte des preuves crédibles pour l’écran desktop de création directe et la suppression du bouton de conversion dans la gestion des événements. Il ne couvre toutefois pas les livrables Gate 1 complets et retire le parcours canonique demandé par les références : partir du formulaire d’événement et conserver sa saisie via « Transformer en opération ». Une capture mobile et une vérification tactile manquent également.

## Grille

| Axe | Statut | Justification |
|---|---|---|
| Technique | NON VÉRIFIÉ | Le pack rapporte Angular production et Maven 266 tests sans échec, mais aucune sortie ou commande reproductible n’est jointe au pack. Le code de création directe ouvre bien l’éditeur ; les tests de conversion et de reprise ne sont pas présents. |
| UI/UX desktop | FAIL | La capture desktop de `/icy/operations/new` est mentionnée et le formulaire est lisible. Le livrable Gate 1 exige aussi des wireframes/mockups des trois zones (création, organisation, participant) et une comparaison visuelle avec IceForge ; seules des affirmations sur l’écran de création sont fournies. |
| UI/UX mobile | NON VÉRIFIÉ | Le pack coche explicitement la capture mobile comme manquante. Aucun test tactile, largeur 390 px ou preuve de débordement n’est fourni. |
| Sécurité | NON VÉRIFIÉ | Les contrôles serveur et les migrations sont reportés dans les étapes suivantes ; le dossier Gate 1 ne fournit pas de test d’accès, de brouillon ou de deep-link. |
| Métier | FAIL | La V1 demande le parcours formulaire événement → « Transformer en opération » avec conservation intégrale. Le bouton a été supprimé et seul `/icy/operations/new` reste accessible : c’est un raccourci qui remplace le parcours canonique, sans preuve de conservation des options de l’événement. |
| Non-régression | NON VÉRIFIÉ | La suppression du bouton évite le doublon, mais aucun scénario événement classique, calendrier, participation ou mobile n’est rejoué dans le pack. |

## Écarts bloquants

- Réintroduire le parcours canonique depuis le formulaire événement, ou faire accepter explicitement une décision produit qui le remplace ; le document de reprise autorise le raccourci uniquement en complément.
- Fournir les wireframes puis mockups haute fidélité desktop/mobile des écrans création/conversion, éditeur organisation et fiche participant.
- Ajouter captures réelles au moins en desktop large et mobile 390 px, avec vérification tactile et états obligatoires.
- Joindre des commandes et sorties reproductibles pour le build Angular, Maven et le parcours de création ; les mentions du pack ne suffisent pas comme preuve indépendante.

## Preuves examinées

- `docs/operations/GATE-1-UX.md` décrit une capture CUA desktop à `127.0.0.1:18088`, mais déclare la capture mobile à produire.
- `docs/operations/reviews/GATE-1-REVIEW-PACK.md` indique Docker healthy, migrations 46/47, build Angular et Maven 266 tests ; il laisse la capture mobile et la revue indépendante non cochées.
- `event-management.component.html` ne contient plus de bouton de conversion.
- `operation-create.component.html` fournit seulement le formulaire direct titre/type/description/début/fin.

## Actualisation sécurité — `fd74f2b`

Le commit `fd74f2b` ajoute `roleGuard` avec `roles: ['ADMIN', 'OFFICIER']` sur `/icy/operations/new` et `/icy/operations/:id/edit`. Le deep-link de création et d’édition est donc correctement filtré côté route pour les rôles organisateurs attendus ; la page participant `/icy/operations/:id` reste accessible sous le garde membre `/icy`. Cette correction retire le blocage d’autorisation côté interface, sous réserve des contrôles serveur déjà prévus dans les gates ultérieures.

Le verdict global reste **BLOCKED** : les gaps du parcours canonique, des preuves mobile et des maquettes premium ne sont pas modifiés par cette correction.

## Actualisation — HEAD `65f4c7d`

La décision produit `docs/operations/DECISION-UX-ADMIN-CREATION.md` arbitre explicitement l’entrée officielle par Admin et le retrait du bouton de conversion. Je considère donc le choix de parcours **accepté comme décision produit documentée** pour ce périmètre, sans le requalifier comme défaut de la présente passe. L’écran `/icy/operations/new` apporte maintenant une hiérarchie plus claire (brouillon, étapes, aperçu mission, briefing borné à 50 000 caractères), avec une grille qui s’empile sous 820 px et un formulaire en une colonne sous 640 px.

Les écarts encore réels sont limités aux preuves et à la couverture UX demandées par Gate 1 :

- aucune capture mobile dédiée ni vérification tactile à 390 px ;
- aucun wireframe/mockup haute fidélité joint pour les trois zones (création, éditeur organisation, fiche participant) ;
- aucune capture de l’éditeur ou de la fiche participant permettant d’évaluer leur cohérence visuelle et leur densité ;
- les builds et Docker sont rapportés dans le pack, mais leurs sorties brutes ne sont pas archivées dans ce dossier.

La décision reste **BLOCKED pour clôturer Gate 1**, pour ces seules lacunes de preuve et de maquettes. Le gap « bouton de conversion supprimé » est clos par la décision produit documentée.

## Actualisation — HEAD `bb17de8`

Les preuves runtime communiquées corrigent la réserve fonctionnelle de création : le test CUA a créé `QA Gate 1`, ouvert `/icy/operations/7ad8823f-d82a-4a43-a157-c867ec47bd04/edit`, et la base confirme `activity_type=OPERATION` et `publication_status=DRAFT`. Le `flush` avant `persist` couvre le trigger parent/enfant ; le type est maintenant saisissable avec une `datalist`, ce qui évite de bloquer la création sur une liste vide. Le test viewport 390×844 rapporte `clientWidth=390`, `scrollWidth=390` et `bodyWidth=390`, sans débordement horizontal.

Ces éléments permettent de classer le parcours création et la contrainte mobile de largeur **PASS sur preuves rapportées**. Ils ne remplacent pas les artefacts visuels Gate 1 : aucune capture mobile réelle, aucun wireframe/mockup haute fidélité des trois zones et aucune capture de l’éditeur ou de la fiche participant n’est jointe. Le verdict Gate 1 demeure **BLOCKED uniquement pour ces livrables UX manquants**.

## Décision finale — HEAD `b4cf02a`

Les wireframes structurels des trois zones sont maintenant archivés dans `docs/operations/GATE-1-WIREFRAMES.md`. Le scénario Docker de création, l’ouverture de l’éditeur, la persistance `OPERATION/DRAFT` et la mesure 390×844 sont également documentés dans le pack. La décision produit sur l’entrée Admin est explicite ; le retrait du bouton de conversion n’est plus un écart de cette revue.

| Axe | Décision actuelle |
|---|---|
| Technique | **PASS sur preuves rapportées** : scénario Docker, migration et builds sont consignés ; les sorties brutes restent à archiver pour audit ultérieur. |
| UI/UX desktop | **PASS Gate 1 structurel** : écran de création documenté par capture, aperçu/étapes implémentés, wireframes des trois zones joints. |
| UI/UX mobile | **NON VÉRIFIÉ** : la mesure sans débordement est disponible, mais aucune capture mobile/tactile n’est archivée. |
| Sécurité | **PASS pour le périmètre Gate 1** : entrée et éditeur protégés par les rôles Admin/Officier ; les tests serveur détaillés restent dans les gates fonctionnelles. |
| Métier | **PASS pour la décision d’entrée Admin** ; conformité complète des groupes, affectations et publication hors périmètre. |
| Non-régression | **NON VÉRIFIÉ** : aucune matrice complète des scénarios historiques n’est jointe à ce pack. |

**Verdict Gate 1 : BLOCKED**, car la preuve mobile/tactile exigée n’est pas archivée et la non-régression reste non vérifiée. Les mockups haute fidélité et les captures détaillées de la fiche participant peuvent être explicitement reportés aux Gates 5/6, à condition de ne pas présenter Gate 1 comme une validation visuelle finale.

