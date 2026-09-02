# Audit de sécurité — historique et état local actuel

Audit initial : **24 août 2026**

Dernière consolidation locale : **2 septembre 2026**

Périmètre : backend Spring Boot, bot Discord, frontend Angular, WebSocket,
RabbitMQ, Docker/Nginx et production observée.

## Comment lire ce document

Deux états doivent rester strictement distincts :

- **historique production** : constats réalisés sur les anciens artefacts et
  l'hôte de production le 24 août 2026 ;
- **candidat local actuel** : code et images reconstruits puis testés localement
  le 2 septembre 2026, sans token Discord ni accès à la production.

Une correction locale ne ferme pas automatiquement le risque en production.
La fermeture exige la rotation des secrets concernés, une sauvegarde vérifiée,
la promotion des images testées et un contrôle après déploiement.

## Verdict actuel

Le candidat local est suffisamment stable pour poursuivre la validation, mais
il **n'est pas prêt à être déployé en production**. Les piles jetable
`iceforge_validation` et persistante `iceforge_dev` sont isolées et n'utilisent
que des données synthétiques.

Les trois bloqueurs opérationnels avant production sont :

1. répéter la migration V29 et la continuité administrateur sur une copie restaurée
   de production, avec `FLYWAY_BASELINE_ON_MIGRATE=false` sur la base déjà versionnée ;
2. tester le bot avec un Discord de développement réel, aucun token de
   production n'ayant été utilisé pendant la campagne ;
3. sauvegarder puis restaurer avec succès PostgreSQL et tous les volumes de
   données avant la moindre mutation de production.

La rotation des anciennes clés et la réduction de l'exposition réseau de
production restent également obligatoires avant promotion.

## État historique observé en production

Les constats de cette section décrivent l'état observé le 24 août 2026. Ils ne
décrivent pas le candidat local reconstruit.

### P0 — services avec état exposés

Les tests SSH et TCP externes avaient confirmé que PostgreSQL `5432`, RabbitMQ
`5672/15672` et Vault `8200` étaient joignables depuis Internet. Vault et
RabbitMQ Management répondaient en HTTP clair. Le pare-feu de l'hôte était
inactif, SELinux désactivé et SSH autorisait root par mot de passe.

La cible reste de n'exposer publiquement que 80/443, avec l'administration par
tunnel ou VPN. Toute modification des services stateful doit suivre une
sauvegarde et un test de restauration ; voir
[`PRODUCTION-ARCHITECTURE.md`](PRODUCTION-ARCHITECTURE.md).

### P0 — secrets historiques

Une ancienne clé backend du bot avait été codée en dur et versionnée. Une URL
AMQP complète avait également pu apparaître dans les anciens logs. Les valeurs
ne sont volontairement pas reproduites ici.

Le code local ne contient plus ces secrets et ses logs masquent désormais les
credentials, mais cela ne révoque pas les valeurs historiques. Il faut encore :

1. renouveler les clés bot, RabbitMQ et JWT concernées ;
2. rechercher les usages anormaux dans les journaux conservés ;
3. invalider les anciennes valeurs ;
4. purger l'historique partagé si nécessaire ;
5. ajouter un secret scan bloquant en CI.

### P1 — anciens défauts applicatifs

L'audit initial avait notamment relevé :

- la possibilité pour un OFFICIER de gérer ou promouvoir des comptes
  privilégiés ;
- des mutations globales accessibles à tout utilisateur authentifié ;
- des routes bot fondées sur un `discordId` fourni par le client ;
- l'absence de contrôle explicite des émissions STOMP `SEND` ;
- un cog Discord de test chargé automatiquement ;
- un endpoint dormant `/notify-password` sans authentification ;
- l'acquittement silencieux de messages RabbitMQ en erreur ;
- un succès Discord annoncé malgré un échec de publication RabbitMQ ;
- un client HTTP bot sans timeout ni cycle de vie de session robuste ;
- des jetons frontend dans `localStorage`, un refresh sur 403 et une couverture
  fonctionnelle insuffisante.

Ces points historiques ne doivent pas être utilisés comme description du code
local actuel ; leur état de remédiation est détaillé ci-dessous.

## Candidat local actuel — remédiations vérifiées

### Autorisation et authentification backend

- Les routes sensibles disposent de contrôles explicites par rôle.
- Un OFFICIER ne peut plus créer, promouvoir, modifier, supprimer ou forcer le
  mot de passe d'un compte privilégié.
- Le CRUD personnel dérive l'identité du JWT ; les recherches inter-utilisateur
  sont réservées au staff.
- Les routes `/api/user-ships/bot` utilisent une identité machine dédiée,
  `Authorization: Bot …`, avec comparaison constante et rôle technique.
- La flotte d'un autre membre exige désormais son UUID, l'événement courant et une
  participation confirmée ; le DTO de participation n'expose plus son Discord ID.
- Les mutations SCWE et de types sont réservées à ADMIN ; les participations
  tierces sont réservées au staff.
- Les mutations d'objectifs, modèles, collections et IceLink sont alignées sur
  la politique frontend/backend.

La source de vérité détaillée est
[`BACKEND-API-AUTHORIZATION-MATRIX.md`](../ops/testing/BACKEND-API-AUTHORIZATION-MATRIX.md).

### Bordure HTTP, CORS et rate limiting

- CORS utilise une liste d'origines exactes.
- La confiance proxy est explicite ; les en-têtes de forwarding forgés sont
  ignorés à la bordure testée.
- Login, refresh, reset et recrutement public disposent d'une limitation
  applicative, vérifiée avec une réponse 429.
- Le rate limiter actuel est en mémoire et convient à une seule instance
  backend. Un stockage partagé sera requis avant une mise à l'échelle.

### Bot Discord et RabbitMQ

- Le client HTTP réutilise et ferme sa session, applique des timeouts, refuse
  les redirections et URL absolues, contrôle les statuts/JSON et masque les
  secrets dans ses logs.
- Le cog de test, le cog `create_event` inutilisable et l'ancien serveur
  `/notify-password` ont été supprimés. FastAPI/Uvicorn ne sont plus embarqués.
- Le bot utilise un retry borné avec délai, une DLQ durable, un `prefetch` et
  une validation JSON minimale. Si le routage vers retry/DLQ échoue, l'original
  est remis en file.
- Le registre SQLite persistant `/app/config/discord-links.sqlite3` mémorise le
  lien Discord avant `*.discordLinked`. Un rejeu connu republie le callback avec
  les mêmes identifiants au lieu de recréer le message Discord.
- Le publisher propage ses échecs : une participation n'est annoncée comme
  enregistrée qu'après une publication réussie.
- Les erreurs des handlers news/event/SCWE ne journalisent plus le texte brut
  des exceptions.
- La vue de flotte limite les interactions à son propriétaire.
- Le conteneur s'exécute avec l'utilisateur non privilégié `iceforge`
  (UID 10001).

### Frontend et parcours navigateur

- Une réponse 403 n'est plus traitée comme un access token expiré.
- Les abonnements WebSocket sont nettoyés et isolés par utilisateur sur les
  topics personnels.
- Toutes les frames STOMP `SEND` provenant d'un client sont refusées côté backend.
- Les routes canoniques, SSR/404, redirections privées, cache API/PWA et
  chargement du hangar ont été durcis.
- Les parcours ADMIN, dashboard peuplé, administration et SCWE ont été vérifiés
  dans un navigateur local.

### Images et exécution

- Backend et bot s'exécutent avec l'utilisateur non privilégié `iceforge`
  (UID 10001).
- Les images sont reconstruites depuis des dépendances verrouillées ; les
  environnements restaurés `.venv` et `node_modules` ne servent pas de base de
  confiance.
- Les secrets locaux, caches et artefacts sont exclus de Git.

## Risques résiduels actuels

### Bloquants avant production

- **Répétition V29/Flyway** : V29 neutralise localement le seed V2 exact et le
  parcours baseline a été testé. La promotion reste interdite avant répétition sur
  copie restaurée, vérification d'un autre admin actif et baseline explicitement
  désactivée sur la production déjà versionnée.
- **Production non sauvegardée dans cette campagne** : aucune mutation ne doit
  précéder une sauvegarde/restauration vérifiée de la base, des images et des
  autres volumes persistants.
- **Discord réel non testé** : les tests bot utilisent des doubles Discord ; un
  serveur et un token de développement sont nécessaires avant production.
- **Secrets et réseau historiques** : la rotation et la fermeture effective des
  ports doivent être confirmées sur l'hôte après déploiement.

### Sécurité applicative élevée

- **WebSocket** : `CONNECT`, les abonnements personnels et le refus de toute frame
  client `SEND` sont contrôlés. Les topics globaux restent lisibles par tout JWT ;
  confirmer que cette audience correspond bien au besoin métier avant production.
- **Scores SCWE** : les cartes de points envoyées par le joueur restent
  insuffisamment bornées et auditables. Ajouter maxima, variation maximale,
  validation serveur/staff et idempotence des contributions.
- **Mots de passe temporaires** : ils transitent encore en clair dans RabbitMQ
  avant envoi par DM. Préférer un lien à usage unique et durée courte.
- **DTO** : plusieurs routes historiques renvoient encore directement des
  entités JPA. Les migrer vers des DTO réduits sans casser les contrats.

### Fiabilité et durcissement complémentaires

- RabbitMQ offre une livraison **at-least-once**, pas une transaction atomique
  avec Discord. Le registre ferme le doublon connu après écriture locale, mais
  une interruption exactement entre la réponse Discord et cette écriture reste
  une fenêtre résiduelle de doublon.
- `on_ready` peut recréer une consommation RabbitMQ sans conserver ni fermer
  explicitement l'ancien manager.
- L'état des rappels Discord reste en mémoire et les tailles de messages,
  mentions et listes doivent être bornées selon les limites Discord.
- Les access et refresh tokens frontend restent dans `localStorage`, ce qui
  augmente l'impact d'une XSS. Une migration vers cookie HttpOnly exige une
  conception CSRF cohérente.
- La bordure ajoute `X-Content-Type-Options` et `Referrer-Policy`, mais une CSP,
  HSTS, protection frame et `Permissions-Policy` complètes restent à définir et
  tester sur la terminaison TLS réelle.
- Le rate limiter en mémoire doit devenir partagé si plusieurs instances
  backend sont déployées.

### Dettes backend modérées encore observables

- Bean Validation n'est pas appliquée de façon générale aux DTO entrants ; les
  contrôles restent dispersés dans les services.
- Plusieurs tailles de page fournies par le client ne sont pas plafonnées.
- Les mises à jour d'objectifs effectuent plusieurs écritures sans transaction
  ni verrou optimiste explicite.
- `users.username` n'est pas unique en base alors que certains accès métier
  supposent une résolution sans ambiguïté.
- Vault utilise encore une adresse HTTP par défaut. En production, imposer TLS
  ou un transport privé explicitement maîtrisé.
- L'audit des dépendances frontend doit être rejoué sur l'image candidate juste
  avant promotion ; les anciens chiffres de vulnérabilités du 24 août ne sont
  pas présentés comme l'état actuel.

## Preuves de validation locale actuelles

Les valeurs ci-dessous sont celles de la campagne du 2 septembre 2026 et
remplacent les anciens chiffres de l'audit initial.

| Surface | Résultat | Portée |
|---|---:|---|
| Backend | 144/144 | Maven, Java 25, construction d'image |
| Frontend unitaire | 58/58 | composants, services, routes, hangar, WebSocket |
| Frontend/API | 85/85 | routes, rôles, refus, redirections, cache et PWA via Nginx |
| Bot | 49/49 | Python 3.14, backend réel, RabbitMQ réel, retry, DLQ et déduplication |
| Dépendances bot | OK | `pip-audit` : aucune vulnérabilité connue |
| Dépendances frontend prod | Accepté | 0 critique/élevée, 3 modérées transitives via Express 4 / `qs` ; correction nécessitant Express 5 et revalidation SSR |
| Reverse proxy | OK | proxy exact en `/32`, en-têtes forgés ignorés, réponse 429 |
| Navigateur | OK | connexion ADMIN, dashboard peuplé, accès admin et SCWE |
| Compose | OK | validation, développement et production résolus |
| Intégrité du diff | OK | `git diff --check` sans erreur |

Cette campagne ne comprend ni pentest externe de la nouvelle version, ni test
avec Discord réel, ni sauvegarde/restauration de la production.

Les trois avis frontend modérés sont un risque résiduel connu pour cette
candidate. Ils ne concernent pas Angular directement et leur suppression impose
une migration majeure vers Express 5 ; cette migration doit être traitée dans
un changement séparé avec une nouvelle campagne SSR/hydratation.

Le détail opérationnel et les commandes reproductibles sont dans
[`LOCAL-STABILIZATION-REPORT.md`](../ops/testing/LOCAL-STABILIZATION-REPORT.md).

## Plan de sortie vers la production

### Avant toute mutation de production

1. Inventorier précisément la base et tous les volumes persistants.
2. Effectuer les sauvegardes, les restaurer dans un environnement isolé et
   conserver les preuves de restauration.
3. Faire tourner les secrets historiques et préparer le rollback.
4. Rejouer V29, le précontrôle admin et `FLYWAY_BASELINE_ON_MIGRATE=false` sur une copie restaurée.
5. Tester le bot sur un Discord de développement réel.

### Conditions minimales de promotion

- aucun P0/P1 non accepté explicitement ;
- matrices 401/403 et parcours critiques toujours vertes ;
- politique d'audience des topics globaux décidée ;
- retry, DLQ et registre d'idempotence supervisés ;
- sauvegarde/restauration répétable et rollback documenté ;
- secrets absents des logs et des images ;
- digest des images déployées identique à celui des images validées.
