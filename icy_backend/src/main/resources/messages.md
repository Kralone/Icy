
### Succès

| Catégorie   | Type    |   HTTP Code |   Code | Titre                      | Message                          |
|-------------|---------|-------------|--------|----------------------------|----------------------------------|
| Succès      | found   |         200 |   1001 | Récupération d'utilisateur | Utilisateur trouvé avec succès   |
| Succès      | created |         201 |   1002 | Création d'utilisateur     | Utilisateur créé avec succès     |
| Succès      | deleted |         200 |   1003 | Suppression d'utilisateur  | Utilisateur supprimé avec succès |
| Succès      | found   |         200 |   1010 | Récupération de vaisseau   | Vaisseau trouvé avec succès      |
| Succès      | found   |         200 |   1020 | Récupération d'événement   | Événement trouvé avec succès     |
| Succès      | added   |         201 |   1030 | Ajout de participant       | Participant ajouté avec succès   |

### Erreurs Logiques

| Catégorie        | Type          |   HTTP Code |   Code | Titre                              | Message                                                                |
|------------------|---------------|-------------|--------|------------------------------------|------------------------------------------------------------------------|
| Erreurs Logiques | notfound      |         404 |   2001 | Utilisateur introuvable            | Aucun utilisateur trouvé avec cet ID                                   |
| Erreurs Logiques | createfailed  |         409 |   2002 | Échec de la création d'utilisateur | Impossible de créer l'utilisateur, veuillez vérifier les informations. |
| Erreurs Logiques | notfound      |         404 |   2010 | Vaisseau introuvable               | Aucun vaisseau trouvé avec ce nom                                      |
| Erreurs Logiques | notfound      |         404 |   2020 | Événement introuvable              | Aucun événement trouvé avec cet ID                                     |
| Erreurs Logiques | alreadyexists |         409 |   2030 | Participant existant               | Le participant existe déjà dans l'événement                            |

### Erreurs Serveur

| Catégorie       | Type     |   HTTP Code |   Code | Titre                     | Message                                                           |
|-----------------|----------|-------------|--------|---------------------------|-------------------------------------------------------------------|
| Erreurs Serveur | internal |         500 |   3001 | Erreur Interne du Serveur | Une erreur inattendue est survenue. Veuillez réessayer plus tard. |
