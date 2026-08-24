# Baseline de modernisation

Date de référence : **24 août 2026**

Cette baseline définit les commandes qui doivent rester vertes sur chaque
branche de montée de version. Elle ne constitue pas une validation de la
production ni un test des intégrations réelles Discord, PostgreSQL et RabbitMQ.

## Runtimes déclarés

| Composant | Version de référence | Source |
|---|---:|---|
| Java | 21 | `.java-version`, Maven Enforcer et Docker backend |
| Maven | 3.9.9 | Maven Wrapper |
| Node.js | 24.19.0 LTS | `.nvmrc`, `engines.node` et image Docker épinglée |
| npm | 11.17.0 | `packageManager`, `engines.npm` et image Docker du frontend |
| Python | 3.11.16 | `.python-version` et famille Docker Python 3.11 |

Les images Docker du socle utilisent des tags exacts et des digests immuables.
Les montées de version des runtimes restent isolées dans leurs branches dédiées.

## Contrat de validation

### Backend

```powershell
cd icy_backend
.\mvnw.cmd clean verify
```

Le build impose Java 21 et Maven 3.9.9, exécute les tests et produit un SBOM
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
les tests afin de détecter les environnements virtuels obsolètes ou cassés.

### Compose

```powershell
docker compose config --quiet
```

Ce contrôle valide uniquement la structure et l'expansion des variables. Les
healthchecks, tests de persistance et essais de restauration arrivent dans les
branches d'infrastructure.

## Limites connues de la baseline

- aucun accès à Discord, PostgreSQL ou RabbitMQ réel pendant les tests locaux ;
- aucun démarrage complet du Compose tant que les secrets et healthchecks ne
  sont pas prêts ;
- la clé historique du bot doit encore être révoquée côté production ;
- les quatre avertissements de budget CSS restent à réduire ;
- l'installation npm du poste audité est cassée, mais le CLI Angular local et
  le lockfile du dépôt permettent de tester l'état déjà installé.

## État des audits de dépendances

- bot : `pip-audit` ne signale aucune vulnérabilité connue ;
- frontend de production : `npm audit --omit=dev` signale 13 dépendances
  vulnérables (1 critique et 12 hautes), notamment `websocket-driver`, Angular
  20.3.26 et PostCSS ;
- backend : un SBOM CycloneDX de 125 composants est généré, mais son scan doit
  être branché sur un outil dédié dans la CI.

La correction frontend doit rester une branche de sécurité séparée, avant les
migrations Angular 21 et 22, afin de ne pas mélanger correctifs de sécurité et
changements majeurs de framework.
