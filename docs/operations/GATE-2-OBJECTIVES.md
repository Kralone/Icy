# Gate 2 — Objectifs structurés

## Périmètre

L’éditeur d’opération permet d’ajouter des objectifs principaux et secondaires, de les réordonner et de les supprimer. Les objectifs sont conservés dans le champ `events.operations.objectives` sous forme JSON afin de préserver la compatibilité avec les anciennes valeurs texte.

## Preuve runtime

- Environnement : Docker Compose `iceforge_dev`, frontend `127.0.0.1:18088`, backend `127.0.0.1:18080`.
- Opération de validation : `7ad8823f-d82a-4a43-a157-c867ec47bd04` (`QA Gate 1`, état `DRAFT`).
- Scénario : ajout de deux objectifs principaux et d’un objectif secondaire, déplacement d’un objectif secondaire, sauvegarde depuis l’onglet `Objectifs`.
- Persistance observée :

```json
[
  {"kind":"PRINCIPAL","text":"Préparer la flotte"},
  {"kind":"SECONDAIRE","text":"Documenter le retour"},
  {"kind":"PRINCIPAL","text":"Coordonner le départ"}
]
```

La lecture de la page opérationnelle utilise les mêmes catégories et affiche un repli lisible pour les anciennes valeurs non JSON. Le build Angular Docker a été exécuté après ces changements.

## Décision de gate

Le parcours objectifs est prêt pour revue fonctionnelle. La clôture globale de Gate 2 reste conditionnée aux autres zones de l’éditeur (organisation, inscriptions, aperçu/publication) et à la validation indépendante correspondante.
