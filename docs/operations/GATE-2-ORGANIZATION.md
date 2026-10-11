# Gate 2 — Organisation

Le brouillon d’opération expose maintenant la création, la modification et la suppression contrôlée d’un groupe ou sous-groupe. Le backend vérifie la portée de l’opération, interdit de supprimer un parent qui possède encore des enfants et conserve la contrainte de deux niveaux.

Routes protégées :

- `POST /api/operations/{id}/groups`
- `PUT /api/operations/{id}/groups/{groupId}`
- `DELETE /api/operations/{id}/groups/{groupId}`

L’éditeur Angular propose `Modifier` et `Supprimer`, avec confirmation avant suppression et retour d’état. Le build Docker frontend a été exécuté après l’ajout.

Le périmètre Gate 2 reste ouvert pour le réordonnancement visuel, la délégation des responsables, la coordination des demandes et l’aperçu participant. Ces éléments restent explicitement à traiter dans les gates suivantes.
