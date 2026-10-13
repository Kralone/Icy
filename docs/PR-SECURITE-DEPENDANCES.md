# Texte de PR — correctifs de sécurité des dépendances et des images

PR à ouvrir de `fix/security-dependency-updates` vers `main`. Sans fusion automatique.

**Titre** : Sécurité : dépendances et images corrigées pour le contrôle Trivy

---

## Résumé

Le workflow Security échoue depuis plusieurs semaines. Cette PR corrige ce que Trivy signale, sans désactiver ni assouplir aucun contrôle et sans aucune exception. Une seule montée de version majeure : `async-http-client`.

| Sujet | Changement |
|---|---|
| Angular | 22.1.3 vers 22.2.2 (version mineure), par l'outil de mise à jour d'Angular |
| npm, transitif | `piscina` 5.3.2, `undici` 8.11.2, `fast-uri` 3.1.8, `source-map-js` 1.2.2, `proxy-addr` 2.0.8, SDK MCP de l'outillage |
| pnpm | `pnpm-lock.yaml` et `pnpm-workspace.yaml` retirés : aucun workflow ni image ne les utilise |
| `async-http-client` | 2.15.0 vers 3.0.14 (version majeure, étudiée ci-dessous) |
| `jsoup` | 1.23.1 vers 1.23.2, qui contient le correctif |
| Spring Boot 4.1.1 | Tomcat 11.0.27, Jackson 2.21.7 et 3.1.7, client RabbitMQ 5.34.0 imposés à leur correctif |
| Images de base | Empreintes rafraîchies sur les mêmes étiquettes : Maven, Temurin 25 JRE, Python 3.14.7, nginx 1.30.4 |
| Images d'exécution | Paquets système Alpine mis à niveau à la construction (serveur, frontend, SSR, proxy) |
| PostgreSQL | Même version 18.6 (`18.6-bookworm`), empreinte rafraîchie : paquets Debian corrigés (Perl, PCRE2) |
| RabbitMQ | 4.3.5 vers 4.3.6 (`4.3.6-management`) : OpenSSL corrigé |

Aucune version de Java, Python, Node ou nginx ne change.

## Résultat Trivy

Mêmes version et paramètres que GitHub Actions, sur cette branche fusionnée avec la branche Équipages.

| Analyse | Avant | Après |
|---|---|---|
| Dépôt | 25 alertes HIGH ou CRITICAL, dont 5 CRITICAL | 0 |
| Image serveur | 28 corrigeables relevées | 0 |
| Image bot | 9 | 0 |
| Image frontend | 19 | 0 |
| Image frontend SSR | non relevé | 0 |
| Image proxy | non relevé | 0 |

## PostgreSQL et RabbitMQ

Le contrôle « Runtime image vulnerabilities » analyse aussi les deux images officielles épinglées par empreinte. Leurs empreintes dataient d'août 2026 : 32 alertes HIGH ou CRITICAL corrigeables sur PostgreSQL (Perl, PCRE2, paquets Debian) et 2 sur RabbitMQ (OpenSSL). Ces étapes n'étaient jamais atteintes tant que l'analyse de l'image serveur échouait avant elles.

- PostgreSQL : même étiquette et même version du serveur (18.6-1.pgdg12+2), image reconstruite le 6 octobre 2026. 0 alerte corrigeable. 68 alertes sans correctif Debian restent listées par l'étape d'information, non bloquante, comme avant.
- RabbitMQ : l'image 4.3.5 la plus récente garde l'alerte OpenSSL ; 4.3.6 n'en a aucune.
- Des données créées par les anciennes images sont relues par les nouvelles (essai sur volumes jetables).

Fichiers changés : `docker-compose.yml`, `docker-compose.backup-test.yml`, `ops/staging/docker-compose.staging.yml` et le workflow Security. Non changés : l'image utilitaire des sauvegardes (`ops/backups/lib.sh`, exécutée sans réseau et en lecture seule) et les scripts de migration historiques.

**La production n'est pas corrigée par cette PR.** Ses images PostgreSQL et RabbitMQ sont fixées par un fichier d'exécution sur le serveur, et le script de livraison applicative ne recrée pas ces deux services. Tant qu'une intervention dédiée n'a pas remplacé ces images sur le serveur, le contrôle GitHub analyse les empreintes du dépôt, pas celles en service.

## `async-http-client` 3.0.14

`async-http-client` n'est pas utilisé par le code d'IceForge : il est exigé par `web-push` 5.1.2, la bibliothèque des notifications, qui déclare sa version 2.12.4. La version 2.16.1 laissait deux alertes HIGH (CVE-2026-107227 et CVE-2026-107230), corrigées seulement en 3.0.14.

Trois solutions ont été essayées sur des copies isolées : la version 3.0.14, l'exclusion Maven de la bibliothèque, et une exception Trivy. La version 3.0.14 est retenue : elle corrige les deux alertes à la source et garde utilisables les deux chemins d'envoi de `web-push`. L'exclusion rendait l'envoi asynchrone inutilisable (classe introuvable à l'exécution).

**Netty.** `async-http-client` 3.0.14 est construit contre Netty 4.2.18 ; Spring Boot 4.1.1 gère Netty en 4.2.17, que le client RabbitMQ utilise aussi. L'écart est conservé :

- les 180 classes, 384 méthodes et 102 champs Netty référencés par `async-http-client` 3.0.14 se résolvent de la même façon contre 4.2.17 et contre 4.2.18 ;
- les 9 seules références non résolues sont les transports natifs facultatifs (epoll, kqueue, io_uring), absents dans les deux cas et non utilisés ;
- Trivy ne signale aucune alerte sur Netty 4.2.17.

Imposer 4.2.18 changerait la pile Netty de tout le serveur sans rien corriger. À revoir quand Spring Boot passera à une version de Netty supérieure.

## Vérifications

- Frontend, sur cette branche : installation propre, construction de production, 73 fichiers de tests réussis, `npm audit` sans alerte haute. Sur la copie fusionnée avec Équipages : 88 fichiers de tests réussis.
- Serveur, copie fusionnée : 393 tests, 0 échec, 3 ignorés, dans la construction de l'image.
- Les cinq images se construisent.
- Démarrage réel de l'image serveur sur une pile isolée : Tomcat 11.0.27, 43 migrations, connexion et réponses JSON, trois écouteurs RabbitMQ connectés.
- Web Push, avec `async-http-client` 3.0.14 : notification chiffrée réellement envoyée à un point de réception local par le chemin de l'application (`PushService`, client HTTP Apache) et par le chemin asynchrone (`PushAsyncService`) ; 201 dans les deux cas.
- Notification de bout en bout par l'application : abonnement de test, `POST /api/notifications/push/test`, envoi 201, message reçu chiffré, aucune erreur de chargement de classe.

## Non vérifié

- Aucune exécution GitHub Actions.
- Aucun parcours dans un navigateur après la montée d'Angular.
- Notification vers un vrai service de push de navigateur.
- Le serveur seul sur cette branche : `main` porte un test qui ne compile pas, corrigé par la PR Opérations. Les tests serveur ont donc tourné sur la copie fusionnée.

## À savoir

- La CI de cette PR échouera sur trois défauts de `main` corrigés par la PR Opérations : test qui ne compile pas, version de Node lue par la CI, tests du bot sous un utilisateur ordinaire. À fusionner après elle, ou à mettre à jour ensuite.
- La mise à niveau des paquets système à la construction rend deux constructions de la même révision différentes si un correctif Alpine paraît entre-temps. Les images livrées restent identifiées par leur empreinte.
- Les versions imposées à Spring Boot sont à retirer dès qu'une version plus récente les fournit.

## Avant fusion

- [ ] PR Opérations fusionnée, ou cette branche mise à jour sur `main`
- [ ] CI GitHub verte
- [ ] Parcours rapide du site après la montée d'Angular

🤖 Generated with [Claude Code](https://claude.com/claude-code)
