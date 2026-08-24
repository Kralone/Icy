# IceForge

Plateforme communautaire avec front Angular, backend Spring Boot et bot Discord.
Ce README documente l'application et son architecture sans entrer dans des sujets hors
priorite.

## Vue d'ensemble

IceForge centralise des pages publiques, un espace membre et un back-office
pour gerer des contenus (actus, evenements, objectifs, collections, recrutement,
images, etc.). Le backend expose des API REST et du WebSocket, persiste les donnees
dans PostgreSQL, et orchestre des notifications via RabbitMQ. Le bot Discord
ecoute RabbitMQ pour relayer des informations et interagir avec la communaute.

## Documentation

- [Index de la documentation](docs/README.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Inventaire et audit du frontend](docs/FRONTEND-PAGES.md)
- [Audit de securite](docs/SECURITY-AUDIT.md)
- [Feuille de route produit et visibilite](docs/ROADMAP.md)
- [Plan de modernisation technique](docs/UPGRADE-PLAN.md)
- [Architecture de production](docs/PRODUCTION-ARCHITECTURE.md)
- [Exploitation Docker et rollback](docs/DOCKER.md)
- [Migration PostgreSQL 15 vers 18](docs/POSTGRESQL-18-MIGRATION.md)
- [Migration Vault 1.17 vers 2.x](docs/VAULT-2-MIGRATION.md)
- [Maintenance technique et CI](docs/MAINTENANCE.md)

## Architecture (macro)

```
Browser (Angular)
  |  REST + WebSocket
  v
Spring Boot API  <----->  RabbitMQ  <----->  Bot Discord (Python)
  |                                   |
  v                                   |
PostgreSQL                             |
  ^                                   |
  |                                   v
Images (volume partage via nginx)   Discord
```

## Composants

### Frontend (Angular)

- Base: Angular 22.1, TypeScript 6.0, Tailwind CSS, service worker.
- Couches: `auth`, `core` (services/interceptors), `features` (pages),
  `shared` (layout, composants partages).
- Consommation API REST, WebSocket (notifications, temps reel).

### Backend (Spring Boot)

- Java 25 LTS, Spring Boot 4.1.1.
- REST + WebSocket.
- Security (JWT + refresh), CORS, CSRF.
- Data JPA + Flyway (migrations).
- RabbitMQ (publication/consommation d'evenements).
- Gestion d'upload d'images vers un volume partage.

### Bot Discord (Python)

- Discord.py, FastAPI (API HTTP), RabbitMQ via aio-pika.
- Ecoute des messages RabbitMQ (news, events, users, scwe).
- Publie des evenements vers RabbitMQ si necessaire.

### Infra

- PostgreSQL 18.6 pour la persistence.
- RabbitMQ 4.3.5 pour la messagerie asynchrone.
- Nginx pour servir le front et les images.

## Structure du repo

```
icy-angular/    # Frontend Angular
icy_backend/    # Backend Spring Boot
icy/            # Bot Discord (Python)
images/         # Assets et images (selon usage)
scripts/        # Scripts de deploy/outillage
docker-compose.yml
```

## Donnees et migrations

- Les migrations SQL sont dans `icy_backend/src/main/resources/db/migration`.
- Le backend applique Flyway au demarrage.

## Configuration (valeurs sensibles via variables d'environnement)

Backend (exemples de variables):
- `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`
- `JWT_SECRET`, `JWT_ACCESS_EXPIRATION`, `JWT_REFRESH_EXPIRATION`
- `IMAGE_BASE_URL`, `ICY_IMAGE_PATH`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `BOT_URL`

Bot:
- `DISCORD_TOKEN`, `GUILD_ID`
- `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PSWD`
- `BOT_API_KEY`, partagé avec le backend et fourni uniquement par l'environnement

Ne stockez jamais de secrets en dur dans le code ou le repo.

## Lancer en local (dev)

### Backend

```
cd icy_backend
./mvnw spring-boot:run
```

### Frontend

```
cd icy-angular
npm install
npm run start
```

### Bot

```
cd icy
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.lock
python bot.py
```

## Deploiement (Docker Compose)

En local, le fichier `docker-compose.override.yml` est charge automatiquement et
publie les ports de developpement uniquement sur `127.0.0.1` :

```powershell
docker compose up -d --build --wait
```

En production, utilisez explicitement la surcharge dediee. Elle ne publie que
les ports HTTP/HTTPS du frontend et exige les secrets critiques :

```powershell
docker compose --env-file .\secrets\prod.secrets.env `
  -f .\docker-compose.yml -f .\docker-compose.prod.yml `
  up -d --build --wait
```

La procedure complete de validation, de sauvegarde et de rollback est decrite
dans [la documentation Docker](docs/DOCKER.md).
