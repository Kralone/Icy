# Documentation IceForge

Cette documentation décrit l'état du projet audité le **24 août 2026**. Elle couvre le code local et, lorsque cela est indiqué, le comportement observé sur `https://iceforge.fr`.

## Documents

- [Architecture](ARCHITECTURE.md) — composants, flux, données, déploiement et configuration.
- [Inventaire et audit du frontend](FRONTEND-PAGES.md) — routes publiques, privées et administrateur, SEO, accessibilité et performance.
- [Audit de sécurité](SECURITY-AUDIT.md) — risques priorisés, preuves et plan de remédiation.
- [Feuille de route produit et visibilité](ROADMAP.md) — actions 72 h, 30 jours et 90 jours, contenu, distribution et indicateurs.
- [Plan de modernisation technique](UPGRADE-PLAN.md) — versions cibles, ordre des branches, critères de validation et audit de production.
- [Baseline de modernisation](BASELINE.md) — runtimes déclarés et contrat de validation de chaque branche.
- [Exploitation Docker et rollback](DOCKER.md) — profils local/production, validation isolée, données persistantes et retour arrière.

## Photo rapide du projet

| Élément | État constaté |
|---|---|
| Frontend | Angular 22.1 / TypeScript 6.0, SSR/prérendu et PWA configurés ; build de production réussi ; 47 tests unitaires réussis |
| Backend | Spring Boot 3.5.16 / Java 25.0.4 LTS ; 108 tests réussis ; couverture de branches 7,2 % |
| Bot Discord | Python 3.14.7 / discord.py 2.7.1 / aio-pika 10 ; 5 tests unitaires et 1 test RabbitMQ réussis |
| Données | PostgreSQL, 28 migrations Flyway |
| Temps réel | STOMP/SockJS entre navigateur et backend ; RabbitMQ entre backend et bot |
| Production observée | Pages publiques disponibles, mais déploiement SPA statique incohérent avec le SSR du dépôt |
| Risque le plus urgent | Clé d'authentification du bot codée en dur et présente dans l'historique Git |

## Vérifications exécutées

- parcours navigateur des routes publiques sur desktop et viewport mobile de 390 px ;
- redirections des routes privées vers `/login` ;
- métadonnées rendues, HTML source, sitemap, robots et en-têtes HTTP ;
- Lighthouse mobile sur l'accueil, le guide minage et Wikelo ;
- `npx ng build --configuration production` ;
- `npx ng test --watch=false --browsers=ChromeHeadless` ;
- `npm audit` pour les dépendances de production et de développement ;
- `mvn verify` sous Temurin 25, 108 tests, rapport JaCoCo, démarrage isolé,
  Flyway sur PostgreSQL et connexion RabbitMQ ;
- compilation Python complète, 5 tests unitaires, test AMQP réel isolé,
  `pip check` et `pip-audit` ;
- `docker compose config --quiet` ;
- revue statique des autorisations REST, STOMP, JWT, RabbitMQ, uploads, stockage client et secrets.

## Légende des priorités

| Priorité | Sens | Délai cible |
|---|---|---|
| P0 | secret exposé ou compromission directe | immédiatement |
| P1 | élévation de privilèges, perte de données, falsification ou panne majeure | 72 h à 7 jours |
| P2 | défense en profondeur, robustesse ou qualité importante | 30 jours |
| P3 | dette, cohérence ou amélioration souhaitable | 90 jours |

## Limites de l'audit

Les pages membres et administrateur n'ont pas été ouvertes avec un compte réel : leurs gardes et composants ont été revus dans le code, et leurs redirections anonymes ont été testées en production. L'audit ne remplace pas un pentest actif autorisé, un scan de l'infrastructure depuis Internet, ni les données privées de Google Search Console, Discord Insights ou de l'analytics produit.

## Maintenir ces documents

Mettre à jour cette documentation lors de tout changement de route, de rôle, de topic RabbitMQ/STOMP, de migration ou de stratégie de déploiement. Un changement d'autorisation doit être accompagné d'un test négatif 401/403 et d'une mise à jour de la matrice décrite dans l'audit sécurité.
