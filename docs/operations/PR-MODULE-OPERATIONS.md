# Texte de PR — module Opérations

PR à ouvrir de `feat/operations-lot3-organisation` vers `main`, une fois `main` à jour sur le dépôt distant. Sans fusion automatique.

**Titre** : Module Opérations : brouillons, organisation, flotte, clôture et fiche participant

---

## Résumé

Fiabilise et complète le module Opérations (lots 1 à 3D) : 30 commits au-dessus de `b4f4c0e`.

- **Brouillons** : autosauvegarde discrète avec contrôle de révision, reprise, invisibilité complète pour les membres jusqu'à la publication.
- **Organisation** : groupes et sous-groupes, capacités, modes Libre, Sur validation et Géré, responsables délégués, tableau de coordination.
- **Affectations** : une seule par membre, transfert sur validation sans perte de la place, départ volontaire, contrôles de capacité et de concurrence côté serveur.
- **Flotte** : besoins par modèle, propositions depuis le hangar personnel, validation par les organisateurs, cartes illustrées.
- **Clôture automatique** : à l'heure de fin, l'organisation d'une opération publiée passe en lecture seule pour tous les rôles.
- **Fiche participant** : bannière, présence, « Mon affectation », organigramme, flotte, responsive du mobile au 4K ; aperçu fidèle dans l'éditeur.

## Base de données

Deux migrations dans cette PR : `V52__add_operation_revision.sql` et `V53__add_operation_default_assignment_mode.sql`. Les migrations V40 à V51 du module sont déjà dans `main`.

## Changements de comportement à connaître

- Une opération publiée dont la fin est passée n'est plus modifiable (409), sauf son briefing et ses objectifs.
- Une opération terminée qui a encore des réponses ou des affectations ne peut plus être supprimée.
- Changer les dates d'une opération conserve ses réponses ; un événement classique les remet toujours à zéro.
- Un brouillon dont la fin est passée ne peut pas être publié.
- Supprimer un événement qui a des réponses fonctionne de nouveau (régression introduite puis corrigée dans cette branche).

## Vérifications

- Backend : 344 tests, 0 échec, 3 ignorés (build Docker).
- Front : 279 tests sur la suite complète, puis 91 sur le module après les dernières corrections.
- Parcours réels sur la pile de développement : voir `docs/operations/RECEPTION-FINALE.md`.
- Une revue indépendante par sous-lot, plus une revue finale du module.

## Non vérifié

- Annonce Discord et synchronisation des réponses en conditions réelles : aucun bot n'est branché sur la pile de développement.
- Tests du bot (`icy/tests`) : non exécutés dans cette session.
- Migrations sur une copie de la base de production.

## Constats de la revue finale, non corrigés dans cette PR

- Un message de participation Discord en échec est remis en file sans fin.
- Annonce Discord : objectifs en JSON brut, pas de troncature d'un long briefing.
- La page des brouillons répond 404 au rechargement (route absente de la configuration nginx).
- Modifier le contenu d'une opération publiée ne met pas à jour son annonce Discord.
- La route de conversion d'un événement en brouillon est exposée sans écran qui l'appelle.

## Avant fusion

- [ ] Constats ci-dessus traités ou acceptés
- [ ] `main` à jour sur le dépôt distant
- [ ] Tests du bot exécutés
- [ ] Discord vérifié sur un serveur de test
- [ ] Migrations répétées sur une copie de la production
- [ ] Sauvegarde de la production planifiée

🤖 Generated with [Claude Code](https://claude.com/claude-code)
