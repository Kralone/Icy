# Texte de PR — équipages de vaisseau

PR à ouvrir de `feat/operations-equipages` vers `feat/operations-lot3-organisation`, puis vers `main` une fois la PR Opérations fusionnée. Sans fusion automatique.

**Titre** : Opérations : équipages de vaisseau, postes et presets

---

## Résumé

- **Équipage de vaisseau** : un groupe d'opération peut devenir un équipage rattaché à un modèle du catalogue, avec son image et sa capacité.
- **Postes** : postes facultatifs par équipage (pilote, tourelle, ingénieur…), capacité propre, choisis par le membre ou attribués par l'organisation.
- **Presets** : bibliothèque gérée par les administrateurs ; un preset est copié dans l'opération, jamais référencé.
- **Éditeur** : constructeur d'équipages, sélecteur de vaisseau, confirmation avant abandon.
- **Fiche participant** : carte « Mon équipage », choix du poste, attribution des postes par le responsable délégué.

Un groupe existant reste un groupe standard. Un membre garde une seule affectation : le poste en est un attribut.

## Base de données

Une migration : `V43__create_operation_crews.sql` (colonnes d'équipage des groupes, postes, poste d'une affectation, presets). Elle remplace les migrations de développement V54 et V55 ; la correspondance est dans `icy_backend/MIGRATIONS.md`. Elle s'applique après V40 à V42 de la PR Opérations.

## Permissions

- Écriture des presets : administrateurs.
- Postes d'un équipage : organisateurs et responsable délégué du groupe, contrôlés côté serveur pour chaque action.
- Après l'heure de fin d'une opération publiée, équipages et postes sont en lecture seule.

## Vérifications

- Backend : 393 tests, 0 échec, 3 ignorés (commande de la CI, Java 25).
- Front : 313 tests sur 88 fichiers et construction de production, sous Node 24.
- Migration : montée V38 vers V43 et création depuis une base vide sur PostgreSQL 18 isolé ; schéma `events` identique à celui de développement.
- Parcours réels sur la pile de développement, par lot (E1 à E4), avec captures.
- Revues indépendantes par lot.

## Non vérifié

- Aucune exécution GitHub Actions.
- Refus de la page des presets pour un officier : non rejoué dans un navigateur.
- Parcours en préproduction.

## Avant fusion

- [ ] PR Opérations fusionnée
- [ ] CI GitHub verte sur cette PR
- [ ] Release installée et vérifiée en préproduction

🤖 Generated with [Claude Code](https://claude.com/claude-code)
