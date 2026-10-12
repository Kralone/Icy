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

## Captures

`brouillons-liste.jpg`, `brouillons-liste-mobile.jpg`, `editeur-enregistre.jpg`, `editeur-erreur-reseau.jpg`, `editeur-conflit.jpg`, `editeur-mobile.jpg`. Les captures de l'éditeur datent d'avant les corrections de la revue (texte du conflit et message d'adresse d'image modifiés depuis).

## Suivi

Lot 2 :

- Fermeture de page pendant une écriture en cours : l'envoi forcé part sans contrôle de révision et peut, dans une fenêtre étroite, être refusé après la fermeture.
- Fermeture de page avec un jeton expiré (plus de 15 minutes d'inactivité) : l'envoi de fermeture reçoit un 401 qui n'est pas rejoué.
- Brouillon de plus de 60 Ko : l'envoi de fermeture part sans `keepalive` et peut être annulé par le navigateur.
- Rechargement immédiat : la page rechargée peut lire le brouillon avant la fin de l'envoi de fermeture. Non observé en test.
- Liste des brouillons sans filtre ni pagination ; les brouillons d'opérations passées y restent.
- `updatedAt` est converti avec le fuseau de la JVM ; un changement de fuseau du conteneur décalerait les dates affichées.
- Le verrou optimiste est couvert par des tests à base de mocks et par les tests manuels, pas par un test d'intégration avec base.
- L'état d'enregistrement est affiché dans l'en-tête et près du bouton, car l'en-tête sort de l'écran sur un long briefing.
- Titre, type et dates d'une opération ne sont pas modifiables dans l'éditeur (déjà le cas avant le lot).

Constaté pendant le lot, hors périmètre :

- **Le calendrier (`/api/events/upcoming`) liste les opérations en brouillon à tous les membres** (titre, type, dates). Le contenu du brouillon reste protégé. Comportement antérieur au lot 2, non modifié.
- Un refus d'accès pour rôle insuffisant renvoie 401 au lieu de 403.
- `GET /api/operations/{id}/ships` renvoie 404 sur un brouillon ; l'éditeur l'ignore.

Les anomalies du lot 1 restent listées dans `../lot1/RAPPORT-LOT1.md`.
