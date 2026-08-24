# Baseline de modernisation

Date de référence : **24 août 2026**

Cette baseline définit les commandes qui doivent rester vertes sur chaque
branche de montée de version. Elle ne constitue pas une validation de la
production ni un test des intégrations réelles Discord, PostgreSQL et RabbitMQ.

## Runtimes déclarés

| Composant | Version de référence | Source |
|---|---:|---|
| Java | 25 LTS | `.java-version`, Maven Enforcer et images Temurin épinglées |
| Maven | 3.9.9 | Maven Wrapper |
| Node.js | 24.19.0 LTS | `.nvmrc`, `engines.node` et image Docker épinglée |
| npm | 11.17.0 | `packageManager`, `engines.npm` et image Docker du frontend |
| Python | 3.14.7 | `.python-version` et image Docker épinglée par digest |

Les images Docker du socle utilisent des tags exacts et des digests immuables.
Les montées de version des runtimes restent isolées dans leurs branches dédiées.

## Contrat de validation

### Backend

```powershell
cd icy_backend
.\mvnw.cmd clean verify
```

Le build impose Java 25 et Maven 3.9.9, exécute les tests et produit un SBOM
CycloneDX JSON sous `target/classes/META-INF/sbom/application.cdx.json`.

### Frontend

```powershell
cd icy-angular
npm ci
npm run test:ci
npm run build:production
```

La suite comprend 47 tests. Le build de référence produit le navigateur, le
serveur SSR et quatre routes pré-rendues. Quatre feuilles CSS dépassent encore
le seuil d'avertissement de 10 kB, sans dépasser le seuil bloquant de 14 kB.

### Bot

Voir `icy/README.md`. Une reconstruction isolée des dépendances doit précéder
les tests afin de détecter les environnements virtuels obsolètes ou cassés. La
suite comprend cinq tests unitaires ; un sixième test d'intégration AMQP est
activé lorsque `RABBITMQ_TEST_URL` est défini.

### Compose

```powershell
docker compose config --quiet
```

Ce contrôle valide uniquement la structure et l'expansion des variables. Les
healthchecks, tests de persistance et essais de restauration arrivent dans les
branches d'infrastructure.

## Limites connues de la baseline

- aucun accès à Discord ou PostgreSQL réel pendant les tests locaux ; RabbitMQ
  est testé avec un broker éphémère isolé ;
- la pile Compose isolée est validée, mais elle ne remplace pas un démarrage sur
  l'architecture réelle de production ;
- la clé historique du bot doit encore être révoquée côté production ;
- les quatre avertissements de budget CSS restent à réduire ;
- le Node système du poste audité est plus ancien que la matrice Angular 22 ;
  les validations frontend utilisent donc l'image Node 24.19.0 épinglée.

## État des audits de dépendances

- bot Python 3.14 : `pip-audit` ne signale aucune vulnérabilité connue dans le
  verrou transitif ;
- frontend de production : `npm audit --omit=dev` ne signale aucune
  vulnérabilité ; l'arbre complet de développement conserve 11 alertes
  (4 modérées et 7 hautes) dans la chaîne Karma/Webpack ;
- backend : un SBOM CycloneDX de 152 composants est généré, mais son scan doit
  être branché sur un outil dédié dans la CI.

Les correctifs de sécurité de production, les migrations Angular 21 puis 22,
la migration Python 3.14 du bot, Java 25 et les dépendances compatibles du
backend ont été validés sur des branches séparées. La migration du builder
Karma/Webpack reste un changement d'outillage distinct. Le backend est désormais
validé sous Spring Boot 4.1.1 ; le pont Jackson 2 officiel reste temporaire et
sa suppression exige une migration de contrats JSON séparée.
