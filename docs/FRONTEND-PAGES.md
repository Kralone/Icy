# Inventaire et audit du frontend

> État historique observé le 24 août 2026. L'audit de la candidate locale du
> 2 septembre 2026 remplace les chiffres de dépendances ci-dessous : aucune
> vulnérabilité critique ou élevée en production, trois avis modérés transitifs
> via Express 4 / `qs`. Voir `SECURITY-AUDIT.md`.

## Périmètre testé

Toutes les routes publiques ont été ouvertes sur `https://iceforge.fr` dans un navigateur réel. Elles ont aussi été contrôlées avec un viewport mobile de 390 × 844 px. Les routes protégées ont été testées anonymement jusqu'à leur redirection vers `/login`, puis revues dans le code.

## Routes publiques

| Route | Rôle | État observé | Point principal |
|---|---|---|---|
| `/` | acquisition et présentation | fonctionne | H1 et métadonnées corrects après rendu JS ; image de 11,4 MiB téléchargée |
| `/recrutement` | candidature | fonctionne | formulaire visible ; contrôles sans association `label` exploitable ; redirection serveur vers `/recrutement/` |
| `/guides/minage-star-citizen` | guide débutant | contenu riche | 15 794 caractères, mais marqué « en pause » et daté du 22 février 2026 |
| `/guides/salvage` | guide débutant | fonctionne | contenu court, environ 1 180 caractères |
| `/guides/minage/confirmed` | guide avancé | fonctionne | contenu substantiel, environ 4 720 caractères |
| `/guides/minage/ressources` | ancien alias | redirige | aboutit à `/utilitaires/ressources-minage` |
| `/guides/hathor` | guide opération | fonctionne | contenu substantiel, environ 8 639 caractères |
| `/utilitaires` | catalogue outils | fonctionne | pas de H1 ; une image tierce cassée |
| `/utilitaires/executive-hangar` | statut hangar | fonctionne | données en direct et prochain cycle affichés |
| `/utilitaires/executive-hangar-maps` | cartographie | fonctionne | cinq boutons sans nom accessible |
| `/utilitaires/wikelo` | catalogue Wikelo | fonctionne | 34 vaisseaux observés ; recherche présente |
| `/utilitaires/achat-vaisseaux` | achat/location | fonctionne | catalogue volumineux ; recherche non labellisée sémantiquement |
| `/utilitaires/ressources-minage` | hub minage | partiel | aucune H1 ; image de raffinage cassée ; contenu initial très mince |
| `/utilitaires/guides` | menu guides | fonctionne | seulement deux guides proposés |
| `/login` | connexion | fonctionne | `noindex` après rendu JS ; champs visibles mais sans labels associés |
| route inconnue | page 404 | rendu visuel | le serveur répond HTTP 200 et livre l'accueil avant rendu JS : soft 404 |

## Routes protégées membre

Les routes suivantes sont sous `authGuard` :

| Route | Fonction |
|---|---|
| `/utilitaires/collection` | collection personnelle |
| `/utilitaires/executive-hangar-players` | joueurs autorisés du hangar |
| `/utilitaires/fiches-minage` | opérations de minage internes |
| `/icy/dashboard` | tableau de bord |
| `/icy/profile` | profil |
| `/icy/scwe` | événements mondiaux Star Citizen |
| `/icy/hangar` | hangar personnel |
| `/icy/fleet` | flotte de la corporation |
| `/icy/events` | calendrier et participations |
| `/icy/goals` | objectifs et contributions |
| `/icy/collection` | collections |

Sans session, elles redirigent vers `/login?returnUrl=...`, ce qui a été vérifié pour les trois utilitaires protégés, `/icy` et `/icy/admin`.

## Routes administrateur/officier

`/icy/admin` et ses enfants utilisent `roleGuard` pour `ADMIN` ou `OFFICIER`, avec une restriction `ADMIN` supplémentaire sur le générateur d'orbite.

| Route | Fonction |
|---|---|
| `/icy/admin` | menu administration |
| `/icy/admin/members` | membres et rôles |
| `/icy/admin/collections` | modèles de collection |
| `/icy/admin/events` | événements |
| `/icy/admin/sc-world-events` | SC World Events |
| `/icy/admin/ships` | vaisseaux et marques |
| `/icy/admin/items` | catalogue d'objets |
| `/icy/admin/data` | menu données |
| `/icy/admin/planets` | corps célestes |
| `/icy/admin/stations` | stations |
| `/icy/admin/recrutement` | candidatures |
| `/icy/admin/news` | actualités |
| `/icy/admin/icelinkBuilder` | composition IceLink |
| `/icy/admin/images` | bibliothèque d'images |
| `/icy/admin/uex-cache` | cache UEX |
| `/icy/admin/cig-watch` | veille CIG |
| `/icy/admin/ore-locations` | minerais et lieux |
| `/icy/admin/goals` | objectifs et modèles |

Le garde client améliore l'UX mais ne constitue jamais une autorisation. L'audit backend montre que plusieurs opérations correspondant à ces pages ne contrôlent pas correctement le rôle côté serveur.

## SEO technique observé

### Ce qui fonctionne

- `lang="fr"`, titres, descriptions, canonical, Open Graph et Twitter Card après exécution JavaScript ;
- `robots.txt` exclut `/icy/` et `/login` ;
- sitemap public présent ;
- données structurées `Organization` et `WebSite` sur le document racine ;
- `/recrutement/` dispose d'un HTML prérendu spécifique ;
- les routes publiques ont des URL lisibles.

### Problème majeur : HTML source incorrect

Hormis l'accueil et le recrutement prérendu, le serveur de production livre le HTML de l'accueil pour chaque route : même titre, même description et canonical `https://iceforge.fr/`. Le navigateur corrige ensuite ces éléments avec JavaScript.

Conséquences :

- partage social incorrect pour les robots qui n'exécutent pas JavaScript ;
- canonical contradictoire au premier crawl ;
- délai de rendu et d'indexation ;
- chargement d'assets de l'accueil avant remplacement de la route ;
- soft 404 pour toute URL inconnue ;
- SEO Lighthouse à 100 après JS, mais signal source nettement moins bon.

Le fichier [`app.routes.server.ts`](../icy-angular/src/app/app.routes.server.ts) prérend `/guide/minage` et `/guide/salvage`, alors que les vraies routes sont `/guides/minage-star-citizen` et `/guides/salvage`. Le build audité ne produit que les HTML spécifiques de `/` et `/recrutement`.

Le serveur SSR du dépôt contient un second défaut avant même son déploiement : [`server.ts`](../icy-angular/src/server.ts) ne considère comme succès que `/`, `/login`, `/recrutement` et `/icy/**`. Les routes `/guides/**` et `/utilitaires/**` recevraient donc un statut **404** avec le SSR actuel. Il faut dériver les statuts depuis le routeur ou une liste unique partagée, pas maintenir une whitelist manuelle distincte.

Aliases conservés dans le routeur : `/guides/minage`, `/guides/minage/ressources`, `/guides`, `/guide`, `/guide/minage`, `/guide-minage-star-citizen`, `/guide/salvage`, `/guide/hathor`, `/guide/avance` et `/guide/ressources`. Chacun doit avoir une redirection serveur permanente vers une seule URL canonique.

### Sitemap et fraîcheur

Le générateur assigne la date du build à toutes les URLs, même sans modification du contenu. Il omet `/utilitaires/ressources-minage` et `/utilitaires/guides`, tout en publiant l'ancien alias `/guides/minage/ressources`. Le build de production observé date du 11 juin 2026, alors que le jeu est passé en Alpha 4.9 en juillet 2026.

## Performance de production

Mesures Lighthouse mobile du 24 août 2026 :

| Page | Performance | FCP | LCP | TBT | Poids total |
|---|---:|---:|---:|---:|---:|
| accueil | 60 | 6,4 s | 7,3 s | 90 ms | 13,2 MiB |
| guide minage | 54 | 6,3 s | 7,3 s | 310 ms | 15,2 MiB |
| Wikelo | 58 | 6,3 s | 7,3 s | 100 ms | 18,4 MiB |

Causes principales :

- image externe PNG de hangar exécutif de 11,4 MiB chargée sur les trois pages ;
- images non redimensionnées pour le viewport, jusqu'à 11,8 MiB d'économie estimée ;
- absence de compression texte, environ 589 à 786 KiB économisables ;
- HTTP/1.1 au lieu de HTTP/2 ;
- environ 198 à 278 KiB de JavaScript inutilisé ;
- nombreuses images distantes non maîtrisées et sans variante responsive.

Dans la configuration SSR, `Cache-Control: no-store` est appliqué à tout `location /`, y compris les bundles et assets hashés. Cela annule le cache longue durée configuré côté serveur Node. Séparer HTML dynamique et assets immuables.

Le build local est sain côté compilation : 721,68 KiB brut et environ 165,68 KiB transféré pour le bundle initial. L'écart vient donc largement du déploiement, des médias et du rendu initial incorrect.

## Mobile et accessibilité

Aucun débordement horizontal n'a été observé à 390 px. Points à corriger :

- la navigation mobile ne montre que la marque et « Espace membre » ; guides, ressources et recrutement ne sont plus directement accessibles ;
- nombreux contrôles inférieurs à 44 px de haut ;
- cinq boutons de carte sans texte ni `aria-label` ;
- formulaire de recrutement : six contrôles sans label associé ;
- connexion : deux champs sans label associé ;
- recherche achat vaisseaux non labellisée ;
- pages `/utilitaires` et `/utilitaires/ressources-minage` sans H1.

Lighthouse donne néanmoins 100/100 en accessibilité sur les trois pages échantillonnées : cela ne couvre pas tous les états interactifs ni les associations sémantiques relevées manuellement.

## Tests et dépendances

`npx ng build --configuration production` réussit avec quatre avertissements de budget CSS.

`npx ng test --watch=false --browsers=ChromeHeadless` échoue avant exécution :

- specs utilisant d'anciens noms (`HttpInterceptor`, `CollectionService`, `WebsocketService`, plusieurs variantes `Icelink...`) ;
- trois feuilles de style de test inexistantes, dont `@fortawesome/fontawesome-free` et d'anciens chemins FullCalendar.

Sur 45 specs, 34 se limitent à `toBeTruthy()` et l'ensemble ne contient que 47 assertions : après remise en route, il faut prioriser comportements, erreurs, guards, WebSocket et accessibilité plutôt que les seuls tests de création.

`npm audit --omit=dev` signale 13 vulnérabilités de production : 1 critique et 12 élevées. La critique transitive concerne `websocket-driver`; les avis élevés incluent Angular, PostCSS et `nanoid`. L'audit complet signale 29 vulnérabilités. Mettre à jour vers les versions corrigées, reconstruire, retester SSR/hydratation et ne pas se contenter d'un `npm audit fix --force` aveugle.

## Corrections prioritaires

1. Déployer réellement le SSR ou prérendre toutes les routes indexables avec canonical et statut HTTP corrects.
2. Retirer l'image de 11,4 MiB, héberger des AVIF/WebP responsive et ajouter `srcset`, dimensions et lazy loading.
3. Activer Brotli/gzip et HTTP/2, puis fixer des caches immuables sur les assets hashés.
4. Réparer la suite de tests et rendre le test frontend bloquant en CI.
5. Mettre à jour les dépendances signalées par `npm audit`.
6. Corriger labels, noms accessibles, H1, tailles de cibles et navigation mobile.
7. Automatiser sitemap et données structurées `Article`/`BreadcrumbList` depuis les routes réelles.
8. Remplacer les médias tiers fragiles par des assets maîtrisés et conformes à la politique fan de RSI.

## Défauts fonctionnels et de cycle de vie

- Après une candidature, le code redirige vers `/auth/login`, route inexistante ; la cible correcte est `/login`.
- L'annulation de gestion des collections vise `/collections`, également inexistante.
- Les méthodes de désabonnement STOMP utilisent parfois la destination à la place de l'identifiant de souscription, et plusieurs composants ne libèrent pas leurs souscriptions RxJS. Après plusieurs navigations, mises à jour et messages peuvent être traités plusieurs fois.
- La page événements dépend d'un message STOMP `INIT` sans repli HTTP ni état d'erreur clair.
- La topbar demande automatiquement l'autorisation de notifications push ; attendre une action contextualisée, idéalement après inscription à un événement.
- Le polling de version s'exécute toutes les 60 secondes pour chaque visiteur.
- Le build génère un hash temporel et réécrit le sitemap, ce qui nuit à la reproductibilité.

## Vie privée

La home expose publiquement le pseudo, l'avatar et le statut en ligne des membres via `/api/front/members`, avec rafraîchissement chaque minute. Garder cette vue uniquement avec consentement explicite et contrôle de visibilité ; sinon publier des agrégats anonymes. Les pages et bilans partageables proposés dans la roadmap doivent rester opt-in.

## PWA

Le service worker couvre le shell et les assets, sans stratégie offline pour les données API. Le manifeste est installable mais minimal : pas de description, langue, identifiant, raccourcis, captures ou icône maskable. Ces améliorations sont secondaires par rapport à SSR, sécurité et performance, mais deviennent utiles si l'app doit soutenir événements et checklists en jeu.
