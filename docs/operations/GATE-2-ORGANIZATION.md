# Gate 2 — Organisation

Le brouillon d’opération expose maintenant la création, la modification et la suppression contrôlée d’un groupe ou sous-groupe. Le backend vérifie la portée de l’opération, interdit de supprimer un parent qui possède encore des enfants et conserve la contrainte de deux niveaux.

Routes protégées :

- `POST /api/operations/{id}/groups`
- `PUT /api/operations/{id}/groups/{groupId}`
- `DELETE /api/operations/{id}/groups/{groupId}`

L’éditeur Angular propose `Modifier` et `Supprimer`, avec confirmation avant suppression et retour d’état. Le build Docker frontend a été exécuté après l’ajout.

L’éditeur affiche maintenant aussi la règle de participation, une prévisualisation participant issue du brouillon et des contrôles ↑/↓ qui persistent l’ordre des groupes. Le périmètre Gate 2 reste ouvert pour la délégation des responsables et la coordination détaillée des demandes. Ces éléments restent explicitement à traiter dans les gates suivantes.

Vérification : build Angular Docker réussi ; backend Docker `mvn verify` réussi avec 266 tests, 0 échec et 3 tests ignorés ; conteneurs frontend/backend sains après redéploiement.
