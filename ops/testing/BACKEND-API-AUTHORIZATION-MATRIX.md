# Matrice d'autorisation de l'API backend

Audit statique du 2 septembre 2026. La source de vérité est `SecurityConfig` puis les
`@PreAuthorize` des contrôleurs. Une route non publique et sans annotation exige donc
un JWT valide avec n'importe quel rôle. `STAFF` signifie `ADMIN` ou `OFFICIER`.

| Domaine | Méthodes et routes | Autorisation effective | Contrôle métier / exposition |
|---|---|---|---|
| Auth | `POST /api/auth/login`, `/refresh`, `/logout`, `/reset-password` | Public | Jetons nécessaires dans le corps pour refresh/logout/reset. Limites distinctes par IP et/ou identité selon la route. |
| Auth | `POST /api/auth/admin/force-reset-password` | STAFF | ADMIN: toute cible. OFFICIER: comptes USER seulement; comptes privilégiés protégés. |
| Auth | `GET /api/auth/verify-token`, `/isAdmin` | Auth | Agit seulement sur le jeton courant. |
| Front | les 11 `GET /api/front/**` | Public | DTO publics. Inclut membres, événements récents et catalogues UEX/univers. |
| Recruitment | `POST /api/recruitment` | Public | Création publique voulue; validation/anti-spam à renforcer. |
| Recruitment | `GET /api/recruitment`, `GET/PUT/DELETE /{id}`, `PATCH /{id}/accept`, `/{id}/refuse` | STAFF | Gestion de candidatures. |
| Ships | `GET /api/ships`, `/shipsByBrand`, `/brands`, `/brands/images` | Public | Catalogue public; entités JPA exposées. |
| Ships | `POST /create`, `PUT /update`, `DELETE /api/ships`, mutations `/brands/**` | STAFF | Administration du catalogue. |
| Users | `GET /api/users/{discordId}`, `/all`; `POST /create`; `PUT /update`; suppressions `/by-id`, `/by-discord` | STAFF | Recherche inter-utilisateur réservée au staff. ADMIN gère toutes les cibles; OFFICIER ne peut gérer que les comptes USER ni attribuer un rôle privilégié. Plusieurs réponses restent des entités JPA (dette DTO). |
| Users | `GET /online`; `GET /me/profile`, `/me/stats`; `PATCH /me/profile`; `POST /me/activity`, `/me/avatar` | Auth | Les routes `/me` dérivent l'UUID du jeton. `/online` utilise un DTO réduit. |
| User ships | `GET/POST/DELETE /api/user-ships`, `GET /fleet-summary` | Auth | CRUD personnel dérivé du jeton; résumé global voulu. |
| User ships member | `GET /api/user-ships/member?eventId=…&userId=…` | Auth | DTO réduit uniquement si le membre demandé est confirmé sur l'événement indiqué; aucun Discord ID ni clé bot exposé. |
| User ships bot | `GET/POST/DELETE /api/user-ships/bot` | BOT | Clé `Authorization: Bot …`, comparaison constante et rôle technique dédié. |
| User ships admin | `DELETE /api/user-ships/admin/in-game-acquisitions` | ADMIN | Suppression globale. |
| Events | `POST /create`, `PUT /update`, `DELETE /api/events`, mutations `/types/**` | STAFF | Gestion des événements. |
| Events | `GET /all`, `/types`, `/upcoming`, `/participation`; `POST /participation` | Auth | Participation limitée à l'utilisateur courant. `upcoming` et participations utilisent désormais des DTO réduits. |
| SC world events | tous les `GET /api/sc-world-events/**` | Auth | Lecture, historique, courant, classement et participations propres. |
| SC world events | `POST /api/sc-world-events`, `PUT/DELETE /{id}` | ADMIN | Gestion d'événements mondiaux. |
| SC world participation | `PUT /{id}/participation/me` | Auth | Identité dérivée du jeton. |
| SC world participation | `PUT /{id}/participation?userId|discordId` | STAFF | Écriture inter-utilisateur réservée au staff. |
| SC world event types | `GET /api/sc-world-event-types`, `GET /{name}` | Auth | Lecture. |
| SC world event types | `POST`, `PUT /{name}`, `DELETE /{name}` | ADMIN | Gestion des types. |
| Goals | `GET /api/goals`, `/pinned`, `/{id}/participations`, `/{id}/participations/combined`; `POST /{id}/increment` | Auth | L'incrément est une action membre et journalise l'utilisateur courant dans le service. |
| Goals | `POST /api/goals`, `PUT/DELETE /{id}`, `POST /{id}/pin`, `/pin` | STAFF | Structure, suppression et épinglage désormais réservés au staff. |
| Goal templates | `GET /api/goal-templates` | Auth | Lecture. |
| Goal templates | `POST`, `POST /batch`, `PUT/DELETE /{id}`, `POST /{id}/apply` | STAFF | Gestion et application désormais réservées au staff. |
| Collections | `GET /templates`, `/templates/{id}` | Auth | Lecture des modèles. |
| Collections | `PUT /templates/{name}`, `POST /templates` | STAFF | Gestion des modèles désormais réservée au staff. |
| Collections | `POST /import`; `GET /me`, `/me/{id}`; `PATCH /me/{id}/cell`; `DELETE /me/{id}` | Auth | UUID du jeton transmis au service; le service vérifie la propriété pour lecture/édition et supprime avec `(id,userId)`. |
| IceLink | `GET /api/icelink/blocks` | Auth | Lecture. |
| IceLink | `POST`, `PUT /{id}`, `DELETE /{id}` | STAFF | Builder placé sous `/admin` côté front; mutations désormais alignées côté API. |
| Notifications push | `GET /public-key`, `POST /subscribe`, `DELETE /subscribe` | Auth | Abonnement/désabonnement dérivé du jeton. |
| Notifications push | `POST /test`, `/send` | ADMIN | Envoi et broadcast protégés par sécurité déclarative. |
| Mining sheets | `GET /api/mining-sheets` | Auth | Le DTO masque les détails selon utilisateur/admin. |
| Mining sheets | `GET /sale-locations`; `POST /`; `PUT /{sheetId}`; lock/unlock/finalize | ADMIN | Cycle de vie global. |
| Mining sheets | mutations `/{sheetId}/jobs/**`, `/ships/**`, `/sales` | Auth | Service: fiche ouverte, membre assigné, propriété des jobs/vaisseaux; admin peut outrepasser. |
| Images | tous les `GET /api/images/**` | Auth | Contrairement au commentaire `PUBLIC`, ces routes ne sont pas dans la liste publique de `SecurityConfig`. Résolution de chemin normalisée et confinée au répertoire image. |
| Images | mutations catégories, sous-catégories, tags, upload, metadata et suppression | ADMIN | Écriture disque et catalogue. |
| News | `GET /api/news`, `/types` | Auth | Lecture. |
| News | toutes les mutations news/types | STAFF | Gestion éditoriale. |
| CIG watch | `GET /sources`, `/feed`; `POST /feed/refresh` | STAFF | Restriction au niveau classe. |
| Wikelo | `GET /api/wikelo/ships` | Public | Catalogue explicitement public. |
| Wikelo | `POST /ships/rescrape` | STAFF | Scraping déclenché par staff. |
| Executive hangar | `GET /config` | Public | Configuration publique minimale. |
| Executive hangar | `GET /players` | Auth | Statuts joueurs visibles aux membres. |
| Executive hangar | `POST /next-online`, `/reset`; `PUT /players/{userId}` | STAFF | Écriture inter-utilisateur explicite. |
| UEX datasets | tous les 3 endpoints `/api/utils/uex/datasets/**` | STAFF | Lecture détaillée et refresh du cache. |
| Admin universe/items | tous les endpoints `/api/admin/planets`, `/stations`, `/items`, `/ore-locations` | STAFF | Le préfixe admin accepte volontairement OFFICIER, cohérent avec le garde frontend général. |
| WebSocket | handshake `/ws/**` | Public HTTP, CONNECT authentifié | Origines exactes; JWT requis au CONNECT; `/topic/user/{uuid}` limité au principal. Les autres topics restent visibles à tout JWT. |

## Corrections haute priorité incluses dans cet audit

- Fermeture des mutations de goals, goal templates, collection templates et IceLink
  pour les comptes `USER`.
- Fermeture de la recherche d'un utilisateur par Discord ID pour les comptes `USER`.
- Blocage de l'élévation latérale: un OFFICIER ne peut plus créer/promouvoir un
  ADMIN/OFFICIER, ni modifier, supprimer ou forcer le reset d'un compte privilégié.
- Remplacement des contrôles impératifs des broadcasts push par `@PreAuthorize(ADMIN)`.
- Suppression de la sérialisation directe de `Event` et `EventParticipation` sur les
  routes de lecture utilisées par le frontend.

## Risques restant visibles

- Le rate limiting applicatif est volontairement en mémoire et convient à
  l'instance backend unique actuelle. Il faudra un stockage partagé avant toute
  mise à l'échelle horizontale.
- Plusieurs endpoints historiques staff/public renvoient encore directement des
  entités JPA (`Ship`, `User` sur create/update, types et catalogues). Ils doivent
  migrer vers des DTO sans casser les contrats clients.
- Les topics WebSocket globaux sont accessibles à tout utilisateur authentifié; seule
  la branche `/topic/user/{uuid}` applique une isolation par identité.
- Les tests de contrôleur historiques qui désactivent les filtres ne prouvent pas tous
  l'absence de JWT. La matrice de smoke test Docker couvre ce niveau en complément.
