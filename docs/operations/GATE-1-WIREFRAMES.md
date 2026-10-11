# Gate 1 — Wireframes des trois zones

Ces wireframes décrivent les zones livrées ou vérifiées avant les mockups haute fidélité. Ils servent de contrat de structure pour les gates suivants.

## Création / cadre

```text
┌──────────────────────────────────────────────────────────────┐
│ ← Calendrier     NOUVELLE OPÉRATION · BROUILLON              │
├───────────────────────────────┬──────────────────────────────┤
│ Créer une opération            │ Aperçu de la mission        │
│ 01 Cadre · 02 Organisation     │ type / titre / briefing     │
│                                │ date / organisation         │
│ Titre             Type         │                              │
│ Briefing (compteur)            │                              │
│ Début             Fin          │                              │
│ [Créer le brouillon]           │                              │
└───────────────────────────────┴──────────────────────────────┘
```

Implémentation vérifiée : `operation-create.component.html/css`, avec empilement sous 820 px et une colonne sous 640 px.

## Éditeur organisation

```text
┌──────────────────────────────────────────────────────────────┐
│ Titre opération · Général · Objectifs · Organisation · Aperçu │
├──────────────────────────────────────────────────────────────┤
│ Organisation                                                  │
│ [Créer un groupe]                                             │
│ ┌ Groupe parent ─────────────┐ ┌ Propriétés ───────────────┐ │
│ │ sous-groupes / capacité   │ │ nom, mode, responsable    │ │
│ │ membres / affectations    │ │ sauvegarde / suppression   │ │
│ └───────────────────────────┘ └─────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

La navigation par section est présente dans l’éditeur. Les opérations d’édition, délégation et réordonnancement restent des critères Gate 3.

## Fiche participant

```text
┌──────────────────────────────────────────────────────────────┐
│ HERO : image mission · type · titre · date · participation   │
├───────────────────────────────┬──────────────────────────────┤
│ Briefing                      │ Objectifs                    │
│ contexte / RDV / préparation  │ principaux / secondaires     │
├───────────────────────────────┴──────────────────────────────┤
│ Groupes et affectations · cartes vaisseaux · CTA inscription │
└──────────────────────────────────────────────────────────────┘
```

La page participant fournit déjà le briefing, les objectifs, la participation et les cartes de vaisseaux. La composition détaillée des membres et des responsables reste à valider dans les gates groupes/affectations.
