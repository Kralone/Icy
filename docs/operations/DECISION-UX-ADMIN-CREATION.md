# Décision produit — création depuis Admin

## Décision

À la demande explicite du produit, la création d’une opération est portée par le panneau Admin via `/icy/operations/new`. La gestion des événements ne présente plus de bouton de conversion.

## Portée

Cette décision remplace le raccourci visuel événement → opération dans l’interface. Le service backend de création d’opération reste disponible pour les intégrations et la compatibilité, mais l’entrée utilisateur officielle est l’écran Admin. La création ouvre un brouillon dans l’éditeur afin de conserver les étapes d’organisation et de publication.

## Conséquence d’audit

Les critères `CRT-02` et `CRT-03` des documents de référence doivent être relus selon cette décision : ils ne peuvent pas être déclarés conformes par la présence d’un bouton retiré à la demande du produit. La conservation des données concerne le modèle de brouillon créé depuis Admin et doit être validée dans Gate 2.
