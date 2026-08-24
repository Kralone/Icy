# Maintenance des dépendances et de l'infrastructure

Cette politique empêche IceForge de retomber dans une accumulation de versions
obsolètes. Elle complète le plan de modernisation et ne déploie rien
automatiquement.

## Contrôles automatiques

La CI s'exécute sur chaque pull request et sur `main` :

- backend Java 25 : `mvn clean verify`, 108 tests, JaCoCo et SBOM CycloneDX ;
- frontend Node 24/Angular 22 : installation verrouillée, build de production et
  47 tests headless ;
- bot Python 3.14 : installation de `requirements.lock`, `pip check`, compilation
  et tests unitaires ;
- résolution des configurations Compose de base, validation et production ;
- construction et démarrage d'une pile Compose isolée, appel de l'API à travers
  Nginx et contrôle des files RabbitMQ ;
- suppression systématique des volumes et réseaux de CI.

Le workflow de sécurité utilise Trivy pour les vulnérabilités, secrets et erreurs
IaC du dépôt. Les dépendances de développement sont incluses : le compilateur et
les outils de build font partie de la chaîne d'approvisionnement. Le scan des
manifests fonctionne hors ligne après actualisation de la base Trivy afin qu'une
limitation de débit Maven Central ne rende pas la CI aléatoire.

Les images finales du backend, du bot et du frontend sont bloquées sur toute
vulnérabilité haute ou critique corrigible. Pour les images éditeur PostgreSQL et
RabbitMQ, le contrôle bloquant porte sur les paquets du système d'exploitation ;
les binaires auxiliaires embarqués par l'éditeur sont revus lors de chaque montée
de digest. Cette séparation évite de masquer les vulnérabilités applicatives tout
en tenant compte des composants que le projet ne construit pas. CodeQL analyse
Java, TypeScript/JavaScript et Python. La revue de dépendances bloque une pull
request qui introduit une vulnérabilité de sévérité haute ou critique.

Toutes les actions tierces sont épinglées par SHA. Dependabot surveille aussi
ces SHA afin de proposer leurs mises à jour.

## Cadence

Dependabot vérifie chaque semaine Maven, npm, pip, les Dockerfiles/Compose et les
GitHub Actions. Les versions mineures et correctives compatibles sont groupées ;
les versions majeures restent isolées pour préserver un rollback lisible.

Une pull request automatique n'est jamais fusionnée sans :

1. lecture des notes de version et des ruptures ;
2. lockfiles et digests cohérents ;
3. CI, scans et smoke test au vert ;
4. branche limitée à un écosystème ou un palier cohérent ;
5. stratégie de retour au commit et aux images précédentes.

## Services avec état

PostgreSQL, RabbitMQ et Vault ne sont jamais promus automatiquement, même si
Dependabot détecte une image plus récente. Une mise à jour doit posséder sa
branche, une sauvegarde restaurée, une répétition sur volume isolé, un go/no-go
et un rollback documenté. Les digests précédents sont conservés pendant la
fenêtre d'observation.

## Fin de support

Chaque trimestre, vérifier les calendriers officiels de Java/Temurin, Node.js,
Angular, Python, Spring Boot, PostgreSQL, RabbitMQ, Nginx et Vault. Ouvrir une
branche de migration au plus tard six mois avant la fin de support de production.
Les RC, previews et tags flottants ne sont pas des cibles de production.

## Activation sur GitHub

Après fusion et push de cette branche :

1. activer le graphe de dépendances, Dependabot alerts et les mises à jour de
   sécurité ;
2. activer Code scanning si GitHub ne le fait pas automatiquement ;
3. protéger `main` et rendre obligatoires `CI`, `Security` et `CodeQL` ;
4. interdire le contournement des contrôles sauf procédure d'urgence tracée ;
5. ne jamais ajouter de secret de production aux workflows de pull request.

Le dépôt public peut utiliser gratuitement la revue de dépendances et CodeQL.
Les workflows ont uniquement `contents: read`, sauf CodeQL qui reçoit
`security-events: write` pour publier ses résultats.
