# Texte de PR — module Opérations

PR à ouvrir de `feat/operations-lot3-organisation` vers `main`, une fois `main` à jour sur le dépôt distant. Sans fusion automatique. La PR Équipages s'appuie sur celle-ci.

**Titre** : Module Opérations : organisation, flotte, clôture, intégration Discord et contrôles de livraison

---

## Résumé

- **Brouillons** : autosauvegarde avec contrôle de révision, reprise, invisibles des membres jusqu'à la publication.
- **Organisation** : groupes et sous-groupes, capacités, modes Libre, Sur validation et Géré, responsables délégués, tableau de coordination.
- **Affectations** : une seule par membre, transfert sur validation sans perte de la place, départ volontaire, contrôles de capacité et de concurrence côté serveur.
- **Flotte** : besoins par modèle, propositions depuis le hangar personnel, validation par les organisateurs.
- **Clôture automatique** : à l'heure de fin, l'organisation et les présences d'une opération publiée passent en lecture seule pour tous les rôles ; briefing et objectifs restent modifiables.
- **Fiche participant** : bannière, présence, « Mon affectation », organigramme, flotte, du mobile au 4K.
- **Discord** : annonce lisible d'une opération avec le seul bouton « Consulter l'opération », mise à jour du même message, rien pour un brouillon ; les événements classiques gardent leurs trois boutons.

## Base de données

Trois migrations portent tout le module : `V40__create_operations_foundation.sql`, `V41__create_operation_organisation.sql` et `V42__create_operation_fleet.sql`. Elles remplacent les migrations de développement V40 à V53, dont les anciennes V40 à V51 déjà présentes dans `main` ; la correspondance est dans `icy_backend/MIGRATIONS.md`. Aucune migration antérieure n'est modifiée.

Production et préproduction sont en V38 (lecture du 13 octobre 2026). Une base de développement ayant joué l'ancienne série doit être reconstruite ; la procédure suivie est décrite dans `icy_backend/MIGRATIONS.md`.

## Changements de comportement à connaître

- Une opération publiée dont la fin est passée n'est plus modifiable (409), sauf son briefing et ses objectifs. Les présences y sont figées, sur le site comme depuis Discord.
- Une opération terminée qui a encore des réponses ou des affectations ne peut plus être supprimée.
- Changer les dates d'une opération conserve ses réponses ; un événement classique les remet toujours à zéro.
- Un brouillon dont la fin est passée ne peut pas être publié.
- **Discord** : le bot ne confirme une réponse que si le serveur l'a enregistrée. Un compte Discord inconnu ou inactif reçoit un échec explicite.
- **RabbitMQ** : un message invalide part en file morte sans être réessayé ; une erreur temporaire est réessayée trois fois au plus.

## Livraison

- `BOT_API_KEY` doit être identique pour le backend et le bot ; ordre backend puis bot.
- Contrôles Flyway de livraison adaptés à V43, resynchronisation Wikelo à faire après déploiement, retour arrière par restauration : voir `ops/production/README.md`.
- Préproduction : le bot reçoit l'adresse du staging pour ses liens ; `deploy.sh` refuse toute autre adresse.
- CI : la tâche frontend lit maintenant `icy-angular/.nvmrc` (Node 24). Elle lisait Node 20 et ne pouvait pas construire.

## Vérifications

- Backend : 371 tests, 0 échec, 3 ignorés (build Docker de cette branche).
- Bot : 90 tests, 7 ignorés.
- Front : pas de suite relancée sur cette branche seule ; 313 tests et la construction de production passent sur la branche Équipages, qui la contient.
- Équivalent local des cinq contrôles de la CI sur la branche Équipages : réussi sous Node 24. Ce n'est pas une exécution GitHub Actions.
- Migrations : montée V38 vers V42 et création depuis une base vide sur PostgreSQL 18 isolé ; schéma comparé à celui de développement, sans différence dans le module.
- Discord : annonces, modification, clôture et réponses vérifiées sur un serveur Discord de test avec de vrais messages.
- Vérifications Flyway de livraison : 11 cas sur bases isolées, nominaux et altérations volontaires.
- Revues indépendantes par lot.

## Non vérifié

- Aucune exécution GitHub Actions : la CI n'a jamais vu ces commits.
- Déploiement en préproduction et parcours dans un navigateur sur le staging : la redirection de port n'est pas encore autorisée pour la clé d'exploitation.
- Les scripts `deploy-application-release.sh` et `verify.sh` n'ont pas été exécutés ; seuls leurs fichiers SQL et leur syntaxe l'ont été.
- Nombre de choix de variantes Wikelo en production.

## Points ouverts

- L'identifiant du message Discord change quand le bot refait l'ordre chronologique du salon (comportement antérieur).
- Dans la fenêtre du calendrier, un refus après clôture affiche un message générique.

## Avant fusion

- [ ] `main` à jour sur le dépôt distant
- [ ] CI GitHub verte sur cette PR
- [ ] Release installée et vérifiée en préproduction
- [ ] Migrations répétées sur une copie de la production
- [ ] Sauvegarde de la production planifiée

🤖 Generated with [Claude Code](https://claude.com/claude-code)
