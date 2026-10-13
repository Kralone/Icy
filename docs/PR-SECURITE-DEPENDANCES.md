# Texte de PR — correctifs de sécurité des dépendances et des images

PR à ouvrir de `fix/security-dependency-updates` vers `main`. Sans fusion automatique.

**Titre** : Sécurité : dépendances et images corrigées pour le contrôle Trivy

---

## Résumé

Le workflow Security échoue depuis plusieurs semaines. Cette PR corrige ce que Trivy signale, sans désactiver ni assouplir aucun contrôle, et sans montée de version majeure.

| Sujet | Changement |
|---|---|
| Angular | 22.1.3 vers 22.2.2 (version mineure), par l'outil de mise à jour d'Angular |
| npm, transitif | `piscina` 5.3.2, `undici` 8.11.2, `fast-uri` 3.1.8, `source-map-js` 1.2.2, `proxy-addr` 2.0.8, SDK MCP de l'outillage |
| pnpm | `pnpm-lock.yaml` et `pnpm-workspace.yaml` retirés : aucun workflow ni image ne les utilise |
| `async-http-client` | 2.15.0 vers 2.16.1, même version majeure |
| `jsoup` | 1.23.1 vers 1.23.2, qui contient le correctif |
| Spring Boot 4.1.1 | Tomcat 11.0.27, Jackson 2.21.7 et 3.1.7, client RabbitMQ 5.34.0 imposés à leur correctif |
| Images de base | Empreintes rafraîchies sur les mêmes étiquettes : Maven, Temurin 25 JRE, Python 3.14.7, nginx 1.30.4 |
| Images d'exécution | Paquets système Alpine mis à niveau à la construction (serveur, frontend, SSR, proxy) |

Aucune version de Java, Python, Node ou nginx ne change.

## Résultat Trivy

Mêmes version et paramètres que GitHub Actions, sur cette branche fusionnée avec la branche Équipages.

| Analyse | Avant | Après |
|---|---|---|
| Dépôt | 25 alertes HIGH ou CRITICAL, dont 5 CRITICAL | 2 |
| Image serveur | 28 corrigeables relevées | 2 |
| Image bot | 9 | 0 |
| Image frontend | 19 | 0 |
| Image frontend SSR | non relevé | 0 |
| Image proxy | non relevé | 0 |

Les 2 alertes restantes sont les mêmes dans les deux analyses : `async-http-client`, CVE-2026-107227 et CVE-2026-107230, corrigées seulement en 3.0.14. Le contrôle Security restera donc rouge tant qu'une décision n'est pas prise sur ces deux alertes (voir plus bas).

## Les deux alertes restantes

`async-http-client` n'est pas utilisé par le code d'IceForge. Il est exigé par `web-push` 5.1.2, la bibliothèque des notifications, prévue pour sa version 2.

- **Chemin d'exécution** : l'application envoie ses notifications par `PushService.send`, qui passe par le client HTTP Apache. Seule la classe `PushAsyncService` de `web-push` utilise `async-http-client`, et l'application ne l'appelle pas. Vérifié dans le jar et par un envoi réel.
- **CVE-2026-107227** : décompression WebSocket non bornée. Ni `web-push` ni IceForge n'ouvrent de WebSocket par cette bibliothèque.
- **CVE-2026-107230** : partage de connexions entre identités Kerberos, SPNEGO, NTLM ou proxy authentifié. Aucun de ces modes n'est configuré.

Conclusion : non applicables en l'état. Exception proposée, non incluse dans cette PR : un fichier `.trivyignore.yaml` limité à ces deux identifiants, avec cette justification et une date de révision à trois mois. Alternative : étudier le passage de `web-push` à `async-http-client` 3.

## Vérifications

- Frontend, sur cette branche : installation propre, construction de production, 73 fichiers de tests réussis, `npm audit` sans alerte haute. Sur la copie fusionnée avec Équipages : 88 fichiers de tests réussis.
- Serveur, copie fusionnée : 393 tests, 0 échec, 3 ignorés, dans la construction de l'image.
- Les cinq images se construisent.
- Démarrage réel de l'image serveur sur une pile isolée : Tomcat 11.0.27, 43 migrations, connexion et réponses JSON, trois écouteurs RabbitMQ connectés.
- Web Push : une notification chiffrée réellement envoyée à un point de réception local, par le chemin de l'application et par le chemin asynchrone ; 201 dans les deux cas.

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
- [ ] Décision sur les deux alertes `async-http-client`
- [ ] Parcours rapide du site après la montée d'Angular

🤖 Generated with [Claude Code](https://claude.com/claude-code)
