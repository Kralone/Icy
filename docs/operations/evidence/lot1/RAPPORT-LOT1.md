# Lot 1 — rapport de vérification (2026-10-12)

Branche `fix/operations-v1-recovery`, commits `2a0c31b` et `9a14508` au-dessus de `b4f4c0e`, plus des corrections non commitées issues des tests manuels.

## Résultats des tests

| Suite | Résultat | Source |
|---|---|---|
| Backend, Java 25, build Docker | 306 tests, 0 échec, 0 erreur, 3 ignorés (`CatalogCorrectionsDatabaseTest`), `BUILD SUCCESS` | `docker compose -p iceforge_dev … up -d --build backend frontend` |
| `OperationTypeValidationTest` | 4 tests, 0 échec | idem |
| `EventServiceTest` | 7 tests, 0 échec | idem |
| `OperationServiceTest` | 3 tests, 0 échec | idem |
| `EventPublisherTest` | 1 test, 0 échec | idem |
| Front, 4 specs opérations | 14 tests passés (création 6, fiche 3, panneau 3, éditeur 2) | `ng test --watch=false --include=…` dans `node:24.19.0-alpine3.24` |

La suite front complète n'a pas été lancée.

## Défauts trouvés en test manuel, corrigés

| Défaut | Preuve avant correction | Preuve après correction |
|---|---|---|
| Création : sélecteur de types bloqué sur « Chargement des types… » tant qu'aucun champ n'est saisi (application sans zone, vue non rafraîchie) | `defaut-creation-types-bloques.jpg` | `apres-creation.jpg`, spec `unlocks the closed type list…` |
| Création, API coupée : message brut « Failed to fetch » | `defaut-creation-api-coupee.jpg` | `apres-creation-api-coupee.jpg` |
| Fiche opération : erreur de présence affichée deux fois (toast + alerte), avec « Failed to fetch » | `defaut-presence-erreur-en-double.jpg` | `apres-fiche-operation-erreur.jpg` |
| `requireExistingEventTypeName` sensible à la casse : `validation` refusé en 400 | réponse API 400 | réponse API 200, type enregistré `VALIDATION` |

## Matrice de conformité

| Point | Statut | Preuve |
|---|---|---|
| 1. Création d'opération | Conforme | Création valide : toast « Brouillon d’opération créé. » puis éditeur. Type inconnu, vide ou nul par `POST /api/operations/create` : 400 avec message. API coupée : « Serveur injoignable… ». Échec historique reproduit sur la logique d'origine : type libre ou nul → 500 générique, cause `null value in column "event_type"`. |
| 2. Présence sur la fiche opération | Conforme | Présent → Peut-être → Indisponible : bouton actif, 3 compteurs et 3 listes cohérents, y compris après F5. Deux comptes : `validation_user` et `validation_admin` listés ensemble. Relecture serveur après chaque réponse (GET après chaque POST). |
| 3. Navigation calendrier → opération → calendrier | Conforme | Parcours effectué dans l'interface, URL et contenu vérifiés. |
| 4. Non-régression de la modale d'événement classique | Conforme | Empreinte identique avant/après sur les sections Présence et Équipage : 25 éléments en état normal, 28 en état d'erreur, 27 propriétés de style calculées, dimensions et textes. Captures `avant-modale-*` et `apres-modale-*`. |
| 5. Éditeur, onglet Publication | Conforme | Date « mardi 20 octobre 2026, 20h00 », statut « Brouillon » puis « Publiée », toast « Opération publiée : elle est visible dans le calendrier. », aucun message dans les onglets Général et Objectifs. |

Limite de la preuve : l'API coupée a été simulée dans le navigateur (rejet de `fetch`), pas par un arrêt du backend.

## Captures

| Écran | Avant (`b4f4c0e`) | Après |
|---|---|---|
| Modale d'événement | `avant-modale-evenement.jpg`, `avant-modale-evenement-erreur.jpg` | `apres-modale-evenement.jpg`, `apres-modale-evenement-erreur.jpg` |
| Fiche opération | `avant-fiche-operation.jpg` | `apres-fiche-operation.jpg`, `apres-fiche-operation-erreur.jpg` |
| Création | `avant-creation.jpg` | `apres-creation.jpg`, `apres-creation-api-coupee.jpg` |
| Aperçu de l'éditeur | `avant-editeur-apercu.jpg` | `apres-editeur-apercu-brouillon.jpg`, `apres-editeur-publication-toast.jpg` |

Captures prises à 817 px de large (panneau navigateur). Le front « avant » tournait sur le backend du lot 1.

## Contrôle PostgreSQL après l'incident de double instance

Une seconde instance PostgreSQL a tourné environ 4 minutes sur le volume `iceforge_dev_postgres18` (09:00–09:04 UTC). Contrôle du 2026-10-12, sans écriture conservée :

| Contrôle | Résultat |
|---|---|
| `data_checksums` | `on` ; `checksum_failures` = 0 sur les 6 bases |
| `pg_dump` complet de `iceforgedb` | code de sortie 0, 240 Mo |
| `bt_index_check(heapallindexed)` sur tous les index B-tree | 286 index (`iceforgedb`), 263 (`qol_v32_verify`), 262 (`qol_catalog_verify`), aucune erreur |
| `verify_heapam` avec TOAST sur toutes les tables | 213, 200 et 199 tables, 0 anomalie |
| Index invalides (`pg_index`) | 0 |
| Flyway | version 51 appliquée, 0 migration en échec |
| Journaux de la base depuis l'incident | aucune erreur de stockage ; seules des erreurs SQL de requêtes de test |

`amcheck` a été créé puis annulé dans la même transaction (`ROLLBACK`) : l'extension n'est pas installée après le contrôle. RabbitMQ, touché par le même incident, répond « fully booted and running ».

## Anomalies secondaires à suivre

- Événements classiques : un type libre ou nul renvoie toujours un 500 générique (`null value in column "event_type"`). Comportement historique conservé à dessein dans le lot 1.
- Création d'opération : l'erreur s'affiche à la fois en toast et sous le formulaire.
- Fiche opération : « ← Calendrier » et « OPÉRATION » sont collés dans l'en-tête. Déjà présent sur `b4f4c0e`.
- Écrans larges (4K) et mobile non vérifiés sur les écrans du lot 1.
- Opération terminée : vérifiée par spec seulement, pas en parcours manuel.
- API coupée : simulée dans le navigateur (rejet de `fetch`), pas par un arrêt du backend.
- Suite front complète non lancée ; le `node_modules` local, installé sous Linux, ne démarre pas sous Windows.
- `docker-compose.dev.yml` : sans `-p iceforge_dev`, la commande de build crée un second projet branché sur les mêmes volumes nommés. C'est la cause de l'incident.
- Données de test laissées dans la base dev : opérations « Lot1 verification creation », « Lot1 test API », « Lot1 test API casse », événement « Lot1 evenement classique ».
