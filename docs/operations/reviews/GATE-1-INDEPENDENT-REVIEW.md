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

