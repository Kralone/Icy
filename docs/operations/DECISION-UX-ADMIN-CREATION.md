# Décision produit — création depuis Admin

## Décision

À la demande explicite du produit, la création d’une opération est portée par le panneau Admin via `/icy/operations/new`. La gestion des événements ne présente plus de bouton de conversion.

## Portée

Cette décision remplace le raccourci visuel événement → opération dans l’interface. Le service backend de création d’opération reste disponible pour les intégrations et la compatibilité, mais l’entrée utilisateur officielle est l’écran Admin. La création ouvre un brouillon dans l’éditeur afin de conserver les étapes d’organisation et de publication.

## Conséquence d’audit

`CRT-02` reste `PARTIEL` car le parcours historique de conversion n’est plus proposé. `CRT-03` est évalué sur le parcours officiel de création directe : la conservation porte sur tous les champs du formulaire historique qui ont une correspondance dans le formulaire Admin et sur les champs propres à l’opération. L’inventaire et la preuve sont dans `evidence/CRT-03-FIELD-INVENTORY-2026-10-11.txt`.
