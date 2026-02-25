# Notifications IceForge

## Perimetre et flux
- Les notifications sont emises par le backend via `NotificationPushService` et partent vers:
  - WebSocket (`/topic/notifications` et `/topic/user/{id}/notifications`)
  - Web Push (si VAPID configure)
- Le payload contient: `title`, `body`, `url` (optionnel), `priority` (1..3).
- La priorite est clamp en backend: `null` => 2, <1 => 1, >3 => 3.
- Cote front, les notifications sont stockees en local (`iceforge.notifications`) avec retention 30 jours (fallback sessionStorage).

## Effets par priorite (UI)
- Priorite 1:
  - Pas de son.
  - Affichage standard dans la liste.
- Priorite 2:
  - Son in-app joue.
  - Affichage standard dans la liste.
- Priorite 3:
  - Son in-app joue.
  - Toast visible 5s (topbar).
  - Mise en avant visuelle (classe `notif-priority-high`).

Notes:
- Les Web Push recus quand la page est visible sont ignores par le handler front (la WebSocket couvre deja le cas).
- Les notifications non lues sont marquees visuellement (classe `notif-unread`).

## Cas par cas (sources backend)

### Collection
- Nouveau template (broadcast)
  - Titre: `Collection : nouveau template`
  - Body: `Le template "<nom>" est disponible.`
  - URL: `/icy/collection`
  - Priorite: 1
  - Source: `CollectionService`

### Evenements
- Creation d'evenement (broadcast)
  - Titre: `Evenement : cree`
  - Body: `<titre> est disponible.`
  - URL: `/icy/events`
  - Priorite: 2
  - Source: `EventService.createEvent`
- Mise a jour d'evenement (dates changees)
  - Broadcast + participants
  - Titre: `Evenement : mis a jour`
  - Body: `<titre> a ete mis a jour.`
  - URL: `/icy/events`
  - Priorite: 2
  - Source: `EventService.updateEvent`
- Suppression d'evenement
  - Broadcast + participants
  - Titre: `Evenement : supprime`
  - Body: `<titre> a ete supprime.`
  - URL: `/icy/events`
  - Priorite: 2
  - Source: `EventService.deleteEvent`
- Rappel 1h avant evenement (participants)
  - Titre: `Evenement : rappel`
  - Body: `<titre> commence dans 1h.`
  - URL: `/icy/events`
  - Priorite: 3
  - Source: `EventService.sendOneHourReminder`

### Objectifs
- Creation d'objectif (broadcast)
  - Titre: `Objectif : cree`
  - Body: `<nom>`
  - URL: `/icy/goals`
  - Priorite: 1
  - Source: `GoalService.createGoal`
- Objectif epingle mis a jour (broadcast)
  - Titre: `Objectif epingle : mis a jour`
  - Body: `<nom>`
  - URL: `/icy/goals`
  - Priorite: 1
  - Sources: `GoalService.updateGoal` + `GoalService.pinGoal`
- Objectif termine (broadcast)
  - Titre: `Objectif : termine` ou `Sous-objectif : termine`
  - Body: message construit avec le nom de l'objectif
  - URL: `/icy/goals`
  - Priorite: 2
  - Source: `GoalService.notifyGoalCompleted`

### Actualites
- Nouvelle actualite (broadcast)
  - Titre: `Actualite : nouvelle`
  - Body: `<titre>`
  - URL: `/icy/dashboard`
  - Priorite: 1
  - Source: `NewsService.create`
- Mise a jour d'actualite (broadcast)
  - Titre: `Actualite : mise a jour`
  - Body: `<titre>`
  - URL: `/icy/dashboard`
  - Priorite: 1
  - Source: `NewsService.update`

### Recrutement
- Nouvelle candidature (admins)
  - Titre: `Recrutement : nouvelle candidature`
  - Body: `Candidature recue pour <username>.`
  - URL: `/icy/admin/recrutement`
  - Priorite: 2
  - Source: `RecruitmentService.create`

### SC World Event (SCWE)
- Creation de SCWE (broadcast)
  - Titre: `SCWE : cree`
  - Body: `<titre> est disponible.`
  - URL: `/icy/scwe`
  - Priorite: 2
  - Source: `ScWorldEventService.create`
- Palier SCWE franchi (global)
  - Broadcast
  - Titre: `SCWE : palier atteint`
  - Body: `<user> a franchi le palier <label> sur <event>.`
  - URL: `/icy/scwe`
  - Priorite: 2
  - Source: `ScWorldEventParticipationService.processMilestones`
- Palier SCWE franchi (categorie)
  - Utilisateur uniquement
  - Titre: `SCWE : palier atteint`
  - Body: `Tu as franchi le palier <label> en <categorie>.`
  - URL: `/icy/scwe`
  - Priorite: 2
  - Source: `ScWorldEventParticipationService.processMilestones`

### Vaisseaux
- Nouveau vaisseau (broadcast)
  - Titre: `Catalogue : nouveau vaisseau`
  - Body: `<nom> est disponible.`
  - URL: `/icy/hangar`
  - Priorite: 1
  - Source: `ShipService.createShip`

### Utilisateurs / Admin
- Nouveau membre (broadcast)
  - Titre: `Membre : nouveau`
  - Body: `<username> a rejoint IceForge.`
  - URL: `/icy/dashboard`
  - Priorite: 1
  - Source: `UserService.createUser`
- Mot de passe mis a jour (utilisateur)
  - Titre: `Compte : mot de passe mis a jour`
  - Body: `Le mot de passe a ete mis a jour.`
  - URL: `/icy/dashboard`
  - Priorite: 2
  - Source: `UserService.updatePasswordAndUnlock`
- Mot de passe reinitialise (utilisateur)
  - Titre: `Compte : mot de passe reinitialise`
  - Body: `Un mot de passe temporaire a ete genere.`
  - URL: `/login`
  - Priorite: 3
  - Source: `UserService.forceResetPassword`
- Compte desactive (admins)
  - Titre: `Admin : compte desactive`
  - Body: `Le compte de <username> a ete desactive.`
  - URL: `/icy/admin/members`
  - Priorite: 3
  - Source: `UserService.deactivateUser`
- Roles mis a jour (admins)
  - Titre: `Admin : roles mis a jour`
  - Body: `Roles de <username> : <role>`
  - URL: `/icy/admin/members`
  - Priorite: 2
  - Source: `UserService.updateUser`

## Envoi manuel (admin)
- Endpoint: `POST /api/notifications/push/send`
  - `broadcast=true` => broadcast global
  - `userIds` non vide => ciblage utilisateurs
  - `priority` optionnel (clamp 1..3, defaut 2)
- Test: `POST /api/notifications/push/test` (admin uniquement)
