# Audit préalable — module Opérations V1

## Périmètre et état Git

Audit réalisé le 11 octobre 2026 dans `C:\Users\floga\IdeaProjects\IceForge` à partir du dépôt local et du cahier des charges `ICEFORGE_CODEX_OPERATIONS_V1.md`.

- Branche courante : `codex/catalog-source-of-truth`.
- Arbre de travail : non propre. Des modifications suivies et des fichiers non suivis concernent le catalogue/Wikelo (notamment `docs/*catalog*`, le composant Angular Wikelo, plusieurs services backend Wikelo et la migration `V39__wikelo_api_recipes.sql`). Elles n'ont pas été modifiées par cet audit.
- `main` local : `c468554`.
- `origin/main` connu localement : `3e6d216` ; `main...origin/main` indique `0 16` (la branche locale est en retard de 16 commits selon les références présentes).
- `git fetch origin --prune` a échoué avec `Permission denied` sur `.git/FETCH_HEAD`.
- `git switch -c feature/operations-v1` a échoué avec `unable to create directory for .git/refs/heads/feature/operations-v1`.
- Aucun push, reset, stash, merge ou écrasement n'a été effectué. La branche Opérations ne peut donc pas encore être créée ni poussée depuis ce checkout.

Cette situation doit être résolue avant toute implémentation : préserver les changements Wikelo, synchroniser `main` sans réinitialisation, puis créer une branche dédiée depuis une base saine.

## Frontend Angular

Le frontend est Angular 22 avec composants standalone, lazy loading, FullCalendar 6, RxJS, Tailwind 4 et des styles globaux IceForge. La zone membre est sous `/icy` et protégée par `authGuard`; les écrans d'administration utilisent `roleGuard` pour `ADMIN`/`OFFICIER`.

Le calendrier est `icy-angular/src/app/features/events/events.component.ts` et utilise `FullCalendarComponent`. Il conserve une vue calendrier et une vue des événements à venir, les mises à jour WebSocket, les compteurs de participation et la modale `event-details-modal`. Le clic actuel (`eventClick`) ouvre la modale via `selectedEvent` et ajoute `eventId` aux query params. Il n'existe pas de route Opérations ni de page participant dédiée.

Le service `core/services/event/event.service.ts` expose les CRUD `/api/events/*`, les types et la participation. `EventDTO` ne porte actuellement ni type d'activité (`EVENT`/`OPERATION`), ni statut de publication/brouillon, ni image de mission, ni données d'organisation.

Les tokens visuels observés sont froids et contrastés (`--front-ink`, `--front-surface`, `--front-ice`, `--front-cyan`, `--front-muted`), avec des composants et états d'asynchronisme réutilisables. Les images de types d'événements et du catalogue/hangar sont déjà des sources potentielles ; aucune image artificielle ne doit être introduite.

## Backend Spring Boot / PostgreSQL

Le backend est Spring Boot 4.1.1, Java 25, JPA, PostgreSQL/Flyway, Spring Security, WebSocket STOMP et RabbitMQ. Les migrations regroupent les tables dans le schéma `events` depuis `V19__group_schemas.sql`; les tables historiques sont `events.events`, `events.event_types` et `events.event_participation`.

`Event` (`db/entity/event/Event.java`) possède un UUID, titre, description, dates obligatoires, créateur, type, état `finished` et identifiants Discord. `EventResponseDTO` expose ces champs. `CreateEventRequest` et `UpdateEventRequest` ne valident pas explicitement les dates/champs par annotations et ne portent aucun brouillon ou contenu d'opération.

`EventService` centralise création, modification, suppression, listing, participations et notifications. Une modification de date supprime actuellement toutes les participations ; ce comportement historique devra être conservé ou changé uniquement avec justification et tests. Les écritures diffusent WebSocket et événements RabbitMQ. `EventController` est sous `/api/events`, avec protection de méthode existante à examiner avant chaque nouvelle écriture/lecture.

Les ressources hangar sont déjà modélisées dans `fleet.user_ships` et accessibles par `UserShipController`/services dédiés. Une proposition d'appareil d'opération devra vérifier côté serveur l'appartenance à `user_ships`, sans confondre propriétaire, pilote et affectation.

## Bot Discord

Le bot Python consomme les routages RabbitMQ `events.created`, `events.updated`, `events.deleted` et `events.ended` dans `icy/messaging/event_handler.py`. Il publie des embeds, conserve les liens via `DiscordLinkStore`, protège les traitements par verrou et utilise `EventParticipationView` pour les boutons Présent/Peut-être/Absent. Le mécanisme d'idempotence et de réordonnancement des messages existe déjà.

Le payload actuel est centré sur l'événement (`id`, titre, description, auteur, date, type, participants). Il ne prévoit pas encore de distinction opération, objectifs, groupes ou lien direct IceForge. L'évolution devra ajouter un bouton URL pour les opérations tout en conservant les boutons et le flux des événements ordinaires.

## Tests et validation disponibles

Le dépôt contient des tests Angular (`npm run test:ci`), tests unitaires Spring/Maven (`mvn test` via `icy_backend/mvnw.cmd`) et une suite Python `icy/tests`, dont des tests de participation, d'idempotence Discord et d'intégration backend. Des scripts de validation existent dans `ops/testing` et des compose de validation à la racine.

Les commandes n'ont pas été lancées pendant cet audit : l'arbre est sale sur un autre chantier et la base Git ne peut pas être synchronisée. Elles devront être exécutées sur la branche Opérations après sécurisation du checkout.

## Architecture proposée, à confirmer après base Git saine

Réutiliser `events.events` et `events.event_participation`, en ajoutant un discriminant d'activité et un statut de publication/brouillon compatible avec les contrats existants. Ajouter une extension 1–1 `operations`, puis les tables d'objectifs, groupes à profondeur maximale deux, affectations, demandes, délégations, besoins de vaisseaux et propositions liées à `fleet.user_ships`.

Le backend doit imposer les règles de capacité, d'unicité d'affectation, de transfert atomique et de délégation dans des transactions et contraintes SQL. Le frontend doit ajouter `/icy/operations/:id` pour la page participant plein écran et un éditeur séparé, puis faire bifurquer uniquement les clics d'opération du calendrier. Les événements classiques doivent garder la modale et les contrats actuels.

## Risques à traiter au checkpoint

1. Base distante non synchronisée et branche de travail impossible à créer avec les permissions actuelles.
2. Arbre de travail contenant un chantier Wikelo non commité dont la provenance et la validation sont hors du périmètre Opérations.
3. Suppression historique des participations lors d'un changement de date, à ne pas casser involontairement.
4. Contrats Discord/RabbitMQ et IDs de messages à préserver pour l'idempotence.
5. Autorisations serveur, brouillons privés, concurrence sur la dernière place et profondeur d'arborescence à couvrir avant toute UI de production.

