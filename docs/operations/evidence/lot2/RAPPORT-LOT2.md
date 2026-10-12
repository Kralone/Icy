# Lot 2 — autosauvegarde et reprise des brouillons (2026-10-12)

Branche `fix/operations-v1-recovery`. Rien n'est poussé.

## Fonctionnement

- **Brouillon** : chaque modification du formulaire principal (briefing, objectifs, rendez-vous, image, option vaisseaux) part au serveur 1,5 s après la dernière frappe, et immédiatement au changement d'onglet, à la sortie de l'éditeur et à la fermeture de la page.
- **Opération publiée** : pas d'autosauvegarde, pour ne pas diffuser chaque frappe aux participants. Le bouton « Enregistrer les modifications » reste manuel.
- **Groupes et besoins de vaisseaux** : déjà enregistrés immédiatement par leurs propres appels ; ils mettent maintenant à jour la date de dernière modification du brouillon.
- **Concurrence** : chaque écriture porte la révision lue. Une révision périmée reçoit un 409 au lieu d'écraser le contenu plus récent. L'éditeur n'a jamais deux écritures en cours.
- **Publication** : possible seulement quand le serveur a confirmé les dernières modifications.

## Résultats des tests

| Suite | Résultat |
|---|---|
| Backend, Java 25, build Docker | 308 tests, 0 échec, 0 erreur, 3 ignorés, `BUILD SUCCESS` |
| `OperationServiceTest` | 5 tests, 0 échec (révision périmée, publication, adresse d'image) |
| Front, 7 specs ciblées | 34 tests passés (autosauvegarde 11, éditeur 7, brouillons 3, création 6, fiche 3, panneau 3, menu admin 1) |

La suite front complète n'a pas été lancée.

## Tests manuels (pile dev, compte admin de test)

| Test | Résultat observé |
|---|---|
| Frappe | 111 caractères → 1 requête ; « Modifications en cours… » → « Enregistrement… » → « Enregistré » |
| Rechargement moins de 1,5 s après une frappe | Texte retrouvé |
| Navigation interne juste après une frappe | Valeur enregistrée en moins de 500 ms |
| Onglets, objectifs, case à cocher, puis reprise depuis la liste | Briefing, 2 objectifs et option retrouvés |
| Brouillon sans objectif | Une ligne vide reste proposée à la reprise |
| Erreur réseau | « Non enregistré » + « Serveur injoignable… » + « Réessayer » ; jamais « Enregistré » avant la réponse du serveur ; reprise correcte ensuite |
| Requête périmée arrivant en retard | 409, contenu récent conservé |
| Deux écritures simultanées sur la même révision | 200 et 409 |
| Conflit dans l'éditeur | « Modifié ailleurs » ; « Garder ma version » et « Charger la version du serveur » vérifiés |
| Adresse d'image incomplète (`https:`) | Le reste du brouillon est enregistré, l'adresse attend d'être complète, un message l'indique |
| Sortie de l'éditeur avec une erreur d'enregistrement | Confirmation demandée, l'éditeur reste ouvert si on refuse |
| Publication | Bouton bloqué pendant l'enregistrement ; après publication, rien ne part sans clic, puis l'enregistrement manuel fonctionne |
| Création d'un groupe | Date de dernière modification avancée, révision inchangée (pas de faux conflit) |
| Droits | Membre simple et anonyme refusés sur la liste des brouillons, l'édition et l'écriture |
| Événement classique | Création 201, participation 200, calendrier 200 |
| Mobile 375 px | Liste et éditeur sans débordement horizontal |

Limites : erreur réseau simulée dans le navigateur ; écran 4K non vérifié ; Discord non testé en réel (aucun fichier d'événement ou de messagerie modifié).

## Revue indépendante

Revue du diff par un agent séparé, en lecture seule : aucun bloquant, 5 constats importants, 10 mineurs.

| Constat | Traitement |
|---|---|
| Adresse d'image en cours de saisie qui bloque toute la sauvegarde, avec message anglais | Corrigé (front et message serveur) |
| Saisies perdues sans avertissement en navigation interne (erreur, conflit, opération publiée) | Corrigé : confirmation à la sortie |
| Éditeur ouvert avant une publication faite ailleurs qui continue d'autosauvegarder | Corrigé : « Garder ma version » repasse en enregistrement manuel |
| Date de dernière modification ignorant groupes et besoins | Corrigé |
| Annonces répétées aux lecteurs d'écran | Corrigé : seules les erreurs sont annoncées |
| Bouton d'enregistrement inerte en conflit ; rechargement serveur en échec qui fermait l'éditeur | Corrigés |
| Révision périmée renvoyée par la publication | Corrigé (trouvé aussi en test manuel) |
| Autres constats mineurs | Voir le suivi ci-dessous |

## Corrections avant validation (2026-10-12)

### Autosauvegarde discrète

| État | Affichage |
|---|---|
| Modifications en cours, sauvegarde réussie | Rien : ni badge, ni horodatage, ni toast |
| Enregistrement en cours | Un petit indicateur d'activité sans texte, à droite de « ← Calendrier » |
| Erreur | Alerte compacte en bas de l'éditeur : « Modifications non enregistrées », « Réessayer », détails repliés |
| Conflit | Même alerte : « Modifié ailleurs : non enregistré », « Garder ma version », « Charger la version du serveur », explication dans « Détails » |
| Départ avec des saisies non enregistrables | Confirmation conservée |

L'alerte ne déplace ni l'en-tête ni le formulaire : elle reste collée en bas de la zone visible. L'indication près du bouton et la mention du statut dans l'en-tête sont retirées. La mécanique de sauvegarde (révisions, 409, une écriture à la fois) n'a pas changé.

### Brouillons invisibles pour les membres

Règle appliquée côté serveur : une opération non publiée n'existe pas pour un membre, ni dans les listes, ni par identifiant, ni en temps réel, ni sur Discord, ni par notification. Les événements classiques ne sont pas concernés.

| Vérification (pile dev, comptes de test) | Résultat |
|---|---|
| 1. Création d'un brouillon par un administrateur | 200 |
| 2. Présent dans la liste des brouillons et dans la gestion des événements de l'administration | oui |
| 3. Calendrier d'un membre (`/api/events/upcoming`, `/api/events/all`, y compris avec `includeDrafts=true`) | absent |
| 3 bis. Calendrier d'un administrateur | absent (les brouillons se gèrent depuis l'administration) |
| 4. Accès direct d'un membre : opération, groupes, vaisseaux, besoins, participations (lecture et écriture), demandes d'affectation | 404, identique à un identifiant inexistant |
| 4 bis. Édition, liste des brouillons, groupes en édition par un membre ; calendrier par un anonyme | 401 |
| 4 ter. Site public (`/api/front/recent-events`) | brouillon absent |
| 5. Après publication | visible dans `/upcoming` et `/all` pour le membre, fiche 200, participation 200 |
| 5 bis. Deux publications successives | une seule annonce (1 `ADD` WebSocket, 1 `events.created`) dans les journaux |
| 6. Événement classique | création 201, visible pour le membre, participation 200 |

Autres changements liés : un brouillon n'est plus annoncé à sa création (calendrier en direct, Discord, notification) ; l'annonce part à la publication, après validation de la transaction. Les rappels programmés et le bloc IceLink ignorent les brouillons. Une réponse Discord sur une opération non publiée est ignorée. Un événement classique converti en opération est retiré des calendriers ouverts et de Discord jusqu'à sa publication.

Tests : backend 313 tests, 0 échec, 3 ignorés (`EventServiceTest` 12, `OperationServiceTest` 5) ; front 28 tests ciblés passés (autosauvegarde 11, éditeur 9, gestion des événements 1, calendrier 7).

### Revue indépendante ciblée (visibilité)

Aucun bloquant, aucune fuite de contenu trouvée. Trois constats importants, corrigés et revérifiés : fuite d'existence par `GET /api/operations/{id}/assignment-requests` (200 au lieu de 404), entrée Discord de participation non filtrée, double annonce possible lors de deux publications concurrentes (la transition est maintenant décidée dans la transaction). Les constats mineurs sont dans le suivi.

### Dernière réserve (2026-10-12)

`GET /api/user-ships/member?eventId=&userId=` : si `eventId` désigne une opération non publiée, un non-organisateur reçoit le même refus que pour un participant non confirmé.

| Appel (pile dev) | Résultat |
|---|---|
| Membre, brouillon sur lequel un administrateur s'est déclaré présent | 403 |
| Membre, identifiant d'événement inexistant | 403, corps identique |
| Administrateur, même brouillon | 200 |
| Anonyme | 401 |
| Membre, après publication | 200 |
| Événement classique : participant confirmé / non participant | 200 / 403, comme avant |

Test ajouté : `UserShipServiceTest` (6 tests, 0 échec). Courte revue : c'est le seul point d'accès hors événements et opérations qui accepte un identifiant d'événement ; le profil utilisateur n'expose qu'un nombre d'événements terminés.

Anciennes annonces Discord : contrôle en lecture seule de la base de développement, 2 brouillons, aucun avec un message Discord (aucun événement de cette base n'en a, le bot n'y est pas relié). Requête à lancer sur une base reliée au bot :

```sql
select e.id, e.title, e.start_date_time, e.created_at, e.discord_channel_id, e.discord_message_id
from events.operations o join events.events e on e.id = o.event_id
where o.publication_status <> 'PUBLISHED' and e.discord_message_id is not null
order by e.created_at;
```

## Captures

`brouillons-liste.jpg`, `brouillons-liste-mobile.jpg`, `editeur-desktop.jpg`, `editeur-mobile.jpg`, `editeur-erreur.jpg`, `editeur-conflit.jpg`, `editeur-conflit-mobile.jpg`. Les trois captures desktop de l'éditeur montrent encore « · Brouillon » dans le surtitre, retiré ensuite ; `editeur-mobile.jpg` montre l'en-tête final.

## Suivi

Lot 2 :

- Fermeture de page pendant une écriture en cours : l'envoi forcé part sans contrôle de révision et peut, dans une fenêtre étroite, être refusé après la fermeture.
- Fermeture de page avec un jeton expiré (plus de 15 minutes d'inactivité) : l'envoi de fermeture reçoit un 401 qui n'est pas rejoué.
- Brouillon de plus de 60 Ko : l'envoi de fermeture part sans `keepalive` et peut être annulé par le navigateur.
- Rechargement immédiat : la page rechargée peut lire le brouillon avant la fin de l'envoi de fermeture. Non observé en test.
- Liste des brouillons sans filtre ni pagination ; les brouillons d'opérations passées y restent.
- `updatedAt` est converti avec le fuseau de la JVM ; un changement de fuseau du conteneur décalerait les dates affichées.
- Le verrou optimiste est couvert par des tests à base de mocks et par les tests manuels, pas par un test d'intégration avec base.
- Titre, type et dates d'une opération ne sont pas modifiables dans l'éditeur (déjà le cas avant le lot).

Constaté pendant le lot, hors périmètre :

- Anciennes annonces Discord de brouillons : aucune dans la base de développement ; à contrôler sur chaque base reliée au bot avec la requête de la section « Dernière réserve ». Aucun message n'est supprimé automatiquement.
- Une opération dont la ligne `operations` manquerait serait masquée partout sauf dans la gestion des événements. Aucun cas connu.
- Site public : un brouillon échu peut occuper une des 3 places des événements récents, la page en affiche alors moins de 3. Aucun contenu ne fuit.
- Un brouillon déjà échu puis publié est annoncé comme disponible.
- Si l'annonce de publication échoue (WebSocket, Discord), l'opération reste publiée et l'annonce n'est pas rejouée.
- Un refus d'accès pour rôle insuffisant renvoie 401 au lieu de 403.
- `GET /api/operations/{id}/ships` renvoie 404 sur un brouillon ; l'éditeur l'ignore.

Les anomalies du lot 1 restent listées dans `../lot1/RAPPORT-LOT1.md`.
