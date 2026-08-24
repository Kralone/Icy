# IceForge Backend (v26w07a)

Backend Spring Boot pour l'application IceForge. Ce service expose des API REST,
du WebSocket, et orchestre la persistance PostgreSQL ainsi que la messagerie
RabbitMQ. Ce README se concentre uniquement sur le backend.

## Stack

- Java 25.0.4 LTS
- Spring Boot 4.1.1
- Spring Web / WebSocket / Security
- Spring Data JPA + Flyway
- RabbitMQ (AMQP)
- PostgreSQL

## Architecture (packages)

```
com.icy.icy_backend
  config/        # configuration Spring, beans, securite, cors, etc.
  controller/    # API REST (auth, users, events, news, images, etc.)
  db/
    entity/      # entites JPA (domain)
    repository/  # repositories Spring Data
  exception/     # exceptions et gestion d'erreurs
  messaging/     # integration RabbitMQ
  security/      # JWT, filtres, config securite
  service/       # logique metier
  utils/         # helpers utilitaires
  websocket/     # endpoints, listeners, DTO websocket
```

## API

- REST base sur les controllers dans `src/main/java/com/icy/icy_backend/controller`.
- WebSocket pour temps reel (notifications, events, etc.).
- JSON via Jackson.

## Fonctionnalites

- Authentification JWT (access/refresh) et securite des routes.
- Gestion utilisateurs et profils (roles, infos publiques, stats).
- Gestion evenements (creation, participation, types).
- Gestion news et notifications (push + temps reel).
- Gestion collections, ships, objectifs et recrutements.
- Gestion images (upload, categories, exposition via volume partage).
- Integration Discord via messagerie RabbitMQ.
- Administration (schemas SCWE, contenus, media).

## Schema (flux backend)

```
Client (Angular)
  |  REST / WebSocket
  v
Spring Boot API
  |  JPA + Flyway
  v
PostgreSQL
  ^
  |  AMQP (publish/consume)
  v
RabbitMQ  <----->  Bot Discord
  |
  v
Images (volume partage / nginx)
```

## Base de donnees

- PostgreSQL.
- Migrations Flyway dans `src/main/resources/db/migration`.
- JPA/Hibernate en `ddl-auto=validate` (schema gere par Flyway).

## Messagerie

- RabbitMQ pour publier/consommer des evenements applicatifs.
- Config dans `src/main/resources/application.yml`.

## Configuration

Principales cles (exemples):

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `JWT_SECRET`
- `JWT_ACCESS_EXPIRATION`
- `JWT_REFRESH_EXPIRATION`
- `IMAGE_BASE_URL`, `ICY_IMAGE_PATH`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `BOT_URL`
- `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PSWD`

Toutes les valeurs sensibles doivent venir des variables d'environnement.

## Lancer en local

```
./mvnw spring-boot:run
```

## Tests

```
./mvnw clean verify
```

Le build impose Java 25 et Maven 3.9.9 ou plus récent. JaCoCo 0.8.15 assure la
couverture du bytecode Java 25 ; l'annotation processor Lombok suit la version
gérée par Spring Boot afin d'éviter un décalage avec la dépendance compilée.
Surefire 3.5.6 exécute les 108 tests via JUnit Platform. Le build génère aussi
un SBOM CycloneDX 1.6 de 151 composants sous
`target/classes/META-INF/sbom/application.cdx.json`.

Les dépendances directes hors BOM actuellement validées comprennent Bouncy
Castle 1.85.2, jsoup 1.23.1 et Commons CSV 1.14.1. Spring Boot 4.1.1 gère
notamment Spring Framework 7, Spring Security 7, Hibernate 7 et Flyway 12. Le
module PostgreSQL de Flyway est requis en plus du starter Boot 4.

Le module officiel `spring-boot-jackson2` reste temporairement présent parce
que les entités, DTO et services exposent encore des types Jackson 2. Sa
suppression et le passage complet à Jackson 3 constituent une migration de
contrats séparée. Les passages à Apache HttpClient 5 et AsyncHttpClient 3 sont
eux aussi des migrations de code, pas de simples changements de version.

## Build

```
./mvnw clean package
```
