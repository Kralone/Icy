# Lot 3, sous-lot 3A — structure et éditeur visuel (2026-10-12)

Branche `feat/operations-lot3-organisation`, créée depuis `fix/operations-v1-recovery`. Rien n'est poussé.

## Ce qui est livré

- **Onglet Organisation de l'éditeur** : arborescence des groupes à gauche (effectif, jauge si une capacité existe, mode, responsable, demandes en attente), et à droite soit la vue d'ensemble, soit la fiche du seul groupe sélectionné (repères, équipage, vaisseaux et besoins, réglages).
- **Création rapide** : « + Groupe » et « + Sous-groupe » créent tout de suite un groupe au nom provisoire, le sélectionnent et ouvrent ses réglages, nom présélectionné.
- **Mode d'affectation par défaut de l'opération** (libre, sur validation, géré), suivi par les groupes qui n'ont pas leur propre mode. Enregistré par l'autosauvegarde sur un brouillon, par le bouton sur une opération publiée.
- **Lecture de la structure pour l'organisateur** : `GET /api/operations/{id}/organization` (effectifs réels, membres, demandes, responsable).
- **Garde-fous serveur** : suppression refusée si le groupe a des membres, des demandes en attente, des besoins ou des vaisseaux proposés ; pas de sous-groupe sous un groupe déjà peuplé ; pas de troisième niveau par déplacement.
- **Mobile et tablette** : arborescence, puis fiche du groupe avec retour.

Hors 3A, prévu ensuite : placement des membres par l'organisateur et coordination (3B), cartes de vaisseaux et acceptation des propositions (3C), vue participant enrichie (3B/3D).

## Tests exécutés

| Suite | Résultat |
|---|---|
| Backend, build Docker | 319 tests, 0 échec, 3 ignorés ; migration V53 appliquée |
| `OperationGroupServiceTest` | 12 tests, 0 échec |
| `OperationAssignmentServiceTest` | 11 tests, 0 échec |
| Front, 4 specs ciblées | 37 tests passés (organisation 12, éditeur 11, fiche 3, autosauvegarde 11) |

Suite front complète non lancée.

## Parcours vérifiés sur la pile dev

Jeu de test « Escorte Nyx » : Alpha (12 places) avec Équipage Polaris (8, sur validation, responsable) et Escadrille (4, libre) ; Bravo avec Équipe FPS (géré) ; Charlie (6, sur validation).

| Parcours | Résultat observé |
|---|---|
| Créer un groupe en un clic, le nommer, capacité et mode | Groupe sélectionné, réglages ouverts, valeurs retrouvées après rechargement |
| Ajouter un sous-groupe | Créé sous le bon parent ; mode proposé « Hérité de Charlie (Sur validation) » |
| Monter, descendre, supprimer | Ordre conservé ; suppression d'un groupe avec sous-groupes refusée avec message |
| Changer le mode par défaut | Groupes sans mode propre mis à jour à l'écran, valeur enregistrée côté serveur |
| Effectifs réels | Un membre affecté et une demande en attente visibles dans l'arborescence et la vue d'ensemble |
| Refus serveur | Groupe occupé, groupe avec besoin lié, troisième niveau, capacité sous l'effectif, affectation sur un conteneur : 400 avec message |
| Réglages non enregistrés | Conservés après un déplacement ; confirmation avant de changer de groupe |
| Demande devenue caduque | Supprimée quand le membre prend directement une place |
| Accès à la structure | Membre et anonyme refusés (401), brouillon comme opération publiée |
| Révision de l'opération | Inchangée par les écritures de groupes |
| Mobile 375 px, tablette 820 px | Arborescence puis fiche, bouton de retour, pas de débordement |

Non vérifié par appel réel : le refus de créer un sous-groupe sous un groupe peuplé (test unitaire seulement) ; écran 4K.

## Revue indépendante

Un agent séparé a relu le diff en lecture seule : aucun bloquant, 6 constats importants, 11 mineurs. Les 6 importants sont corrigés et revérifiés :

1. Sur tablette, la fiche d'un groupe n'avait pas de retour vers la structure.
2. La suppression d'un groupe détachait en silence ses besoins et ses vaisseaux proposés.
3. Des réglages en cours de saisie étaient perdus au déplacement ou au changement de groupe.
4. Le mode par défaut pouvait s'afficher différemment du serveur après une action de groupe.
5. Une demande en attente survivait à une affectation directe du même membre.
6. Une structure pas encore chargée était présentée comme vide, bouton de création actif.

Mineurs corrigés : total « places libres » retiré (il était faux avec un plafond de parent), places libres d'un sous-groupe bornées par son parent, texte du mode « géré », besoin rattaché à un groupe supprimé, lectures tardives de la structure, focus sur le nom après création, nom de groupe retiré des messages d'erreur.

## Captures

`desktop-vue-ensemble-brouillon.jpg`, `desktop-groupe-selectionne.jpg`, `desktop-structure-avec-membre-et-demande.jpg`, `mobile-structure.jpg`, `mobile-fiche-groupe.jpg`. Prises avant les corrections de la revue : le chiffre « Places libres » visible sur deux captures a été retiré depuis.

## Anomalies et risques ouverts

- Mode « géré » : personne ne peut encore placer un membre dans un tel groupe ; l'action arrive avec le 3B.
- Un organisateur ne peut pas encore retirer un membre d'un groupe : un groupe occupé reste donc non supprimable jusqu'au 3B.
- Création d'un sous-groupe pendant qu'un membre s'affecte au même groupe : le parent n'est pas verrouillé, la course reste théoriquement possible.
- Déplacement d'un groupe sous un parent par l'API : le plafond du parent n'est pas recontrôlé (non exposé dans l'interface).
- L'onglet « Vaisseaux et besoins » d'un groupe liste encore tous les besoins de l'opération avec des identifiants de modèle bruts ; refonte prévue au 3C.
- L'éditeur occupe maintenant jusqu'à 1600 px de large sur tous ses onglets (1100 px auparavant).
- Onglets internes de la fiche de groupe : boutons bascule, sans navigation aux flèches.
- Données de test laissées dans la base dev : opération publiée « Escorte Nyx » et ses groupes.
