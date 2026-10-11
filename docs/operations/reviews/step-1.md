# Revue étape 1 — socle technique et calendrier

## Résumé du diff

- `V40__create_operations_foundation.sql` ajoute `events.events.activity_type` (`EVENT`/`OPERATION`) et l’extension `events.operations` avec statut brouillon/publié.
- `V41__harden_operations_integrity.sql` ajoute l’image optionnelle et les triggers d’intégrité sans modifier le checksum de V40.
- `Event`/`EventResponseDTO` exposent le type d’activité sans changer le contrat des événements classiques.
- `GET /api/operations/{id}` expose uniquement une opération publiée aux utilisateurs authentifiés.
- Le calendrier et la liste redirigent les opérations vers `/icy/operations/:id`; les événements classiques conservent leur modale.
- La page Angular dédiée est responsive et gère chargement/indisponibilité.

## Fichiers et commit

Commit : `837f79b feat(operations): add operation foundation and participant route`.

## Validation exécutée

- `./mvnw.cmd -q -DskipTests compile` dans `icy_backend` : succès.
- `pnpm exec ng build --configuration production` dans `icy-angular` : succès.
- Warnings Angular : budgets CSS déjà dépassés sur plusieurs composants existants ; aucun warning ne concerne la page Opération.

Correction après revue indépendante : l’endpoint vérifie désormais `activityType == OPERATION`, et V41 ajoute des triggers PostgreSQL empêchant une extension de référencer un événement classique ou de devenir incohérente lors d’un changement de type. Le bouton non disponible a été remplacé par un état informatif contrasté ; l’extension accepte une image de mission pour réutiliser un asset catalogue, cadrée en couverture.

## Limites connues

- L’éditeur de brouillon, la conversion depuis le formulaire, les groupes, affectations, vaisseaux et Discord ne sont pas encore implémentés.
- La migration n’a pas été appliquée sur une base PostgreSQL de validation dans ce checkpoint.
- La publication d’une opération et sa création restent à ajouter avant de pouvoir exercer le parcours complet.

## Revue indépendante requise

Verdict attendu sur technique, UI/UX, sécurité, métier et non-régression. Vérifier en particulier l’absence de régression du DTO événement, l’autorisation de la lecture publiée, le comportement de refresh du lien direct et le contraste responsive de la page.
