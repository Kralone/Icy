# Matrice de validation API locale

Cette matrice est exécutable via `test-validation-api.ps1`. Elle cible uniquement
le frontend publié et le backend sain portant tous deux le label de la pile Docker
`iceforge_validation`. Les écritures autorisées sont appelées avec un objet vide,
rejeté avant toute persistance.

| Check | Surface | Acteur | Attendu | But |
|---|---|---|---|---|
| AUTH-USER | `POST /api/auth/login` | USER | 200 + rôle USER | Authentification fixture |
| AUTH-OFFICIER | `POST /api/auth/login` | OFFICIER | 200 + rôle OFFICIER | Authentification fixture |
| AUTH-ADMIN | `POST /api/auth/login` | ADMIN | 200 + rôle ADMIN | Authentification fixture |
| PUB-MEMBERS | `GET /api/front/members` | Anonyme | 200 | Route publique frontend |
| PUB-SHIPS | `GET /api/ships` | Anonyme | 200 | Catalogue public |
| ANON-PROFILE | `GET /api/users/me/profile` | Anonyme | 401 ou 403 | Refus sans authentification |
| MEMBER-FLEET-ANON-DENY | `GET /api/user-ships/member?eventId=…&userId=…` | Anonyme | 401 ou 403 | Refus sans authentification |
| PROFILE-USER | `GET /api/users/me/profile` | USER | 200 | Lecture de son profil |
| MEMBER-FLEET-USER | `GET /api/user-ships/member?eventId=…&userId=…` | USER | 200 | Flotte réduite d'un participant confirmé uniquement |
| MEMBER-FLEET-UNRELATED-DENY | même route, membre non confirmé | USER | 403 | Empêche l'énumération arbitraire des flottes |
| PROFILE-OFFICIER | `GET /api/users/me/profile` | OFFICIER | 200 | Lecture de son profil |
| PROFILE-ADMIN | `GET /api/users/me/profile` | ADMIN | 200 | Lecture de son profil |
| USERS-USER-DENY | `GET /api/users/all` | USER | 403 | Annuaire protégé |
| USERS-OFFICIER | `GET /api/users/all` | OFFICIER | 200 | Annuaire officier |
| USERS-ADMIN | `GET /api/users/all` | ADMIN | 200 | Annuaire admin |
| MINING-LOC-USER-DENY | `GET /api/mining-sheets/sale-locations` | USER | 403 | Lecture admin refusée |
| MINING-LOC-OFFICIER-DENY | `GET /api/mining-sheets/sale-locations` | OFFICIER | 403 | Séparation ADMIN/OFFICIER |
| MINING-LOC-ADMIN | `GET /api/mining-sheets/sale-locations` | ADMIN | 200 | Lecture admin autorisée |
| ITEM-CREATE-USER-DENY | `POST /api/admin/items` `{}` | USER | 403 | Mutation officier refusée au membre |
| ITEM-CREATE-OFFICIER-INVALID | `POST /api/admin/items` `{}` | OFFICIER | 400 | Autorisation puis validation, sans écriture |
| ITEM-CREATE-ADMIN-INVALID | `POST /api/admin/items` `{}` | ADMIN | 400 | Autorisation puis validation, sans écriture |
| SCWE-CREATE-USER-DENY | `POST /api/sc-world-events` `{}` | USER | 403 | Mutation admin refusée |
| SCWE-CREATE-OFFICIER-DENY | `POST /api/sc-world-events` `{}` | OFFICIER | 403 | Séparation ADMIN/OFFICIER |
| SCWE-CREATE-ADMIN-INVALID | `POST /api/sc-world-events` `{}` | ADMIN | 400 | Autorisation puis validation, sans écriture |
| MINING-CREATE-USER-DENY | `POST /api/mining-sheets` `{}` | USER | 403 | Mutation admin refusée |
| MINING-CREATE-OFFICIER-DENY | `POST /api/mining-sheets` `{}` | OFFICIER | 403 | Séparation ADMIN/OFFICIER |
| MINING-CREATE-ADMIN-INVALID | `POST /api/mining-sheets` `{}` | ADMIN | 400 | Autorisation puis validation, sans écriture |

La réponse anonyme peut être 401 ou 403 selon le point d'entrée Spring Security ;
dans les deux cas aucune donnée authentifiée n'est retournée. Tous les autres codes
sont stricts. Le script ne journalise ni mot de passe, ni access token, ni refresh
token, ni corps de réponse.

## Runtime frontend, SSR et cache

| Check | Surface | Attendu | But |
|---|---|---|---|
| SPA-* | Toutes les routes de `knownRoutes` | 200 | Préservation automatique de toutes les routes SPA connues |
| SPA-308-* | Tous les alias de `canonicalRedirects` | 308 vers la route canonique, query préservée | Parité automatique avec la politique SSR |
| SPA-* privé | `/login`, `/icy/**` et utilitaires authentifiés | 200 + `Cache-Control: no-store` | Shell privé non conservé par le cache HTTP |
| PWA-MANIFEST-NOCACHE | `/ngsw.json` | 200 + `Cache-Control: no-cache` | Détection des nouvelles versions PWA |
| API-NOSTORE | `/api/front/members` | 200 + `Cache-Control: no-store` | Aucune réponse API conservée par Nginx/navigateur |
| SPA-UNKNOWN-404 | URL inconnue | 404 + shell Angular | Page conviviale et statut HTTP correct |

Le service worker ne déclare aucun `dataGroups` : il ne met donc aucune route
`/api/**` dans son cache. Nginx ajoute en plus `no-store` à toutes les réponses API.

L'image Node SSR et l'image Nginx statique renvoient toutes deux 404 pour une URL
applicative inconnue. Nginx sert néanmoins le shell Angular comme corps de la
réponse afin que le composant « Page introuvable » soit affiché. Le test exécutable
vérifie aussi que toutes les routes applicatives connues continuent de répondre 200.
