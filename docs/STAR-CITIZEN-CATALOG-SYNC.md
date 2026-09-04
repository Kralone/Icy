# Catalogue Star Citizen et rescan externe

## Objectif

Construire un catalogue unifie et traçable couvrant :

- vaisseaux et vehicules terrestres ;
- armes FPS, armes de vaisseau, armures, modules, composants et outils ;
- systemes, planetes, lunes, villes, avant-postes, stations et points de saut ;
- lieux et prix d'achat, de vente et de location ;
- offres et recompenses Wikelo ;
- au moins une image affichee pour chaque fiche.

Le bouton **Rescanner tout** doit importer les sources sans supprimer les corrections
manuelles, produire un bilan lisible et ne publier les nouvelles donnees qu'apres un
scan valide.

Il n'existe volontairement aucun lancement automatique ou planifie : seul un clic
explicite d'un administrateur ou officier demarre un traitement.

## Etat du projet au 4 septembre 2026

Le code analyse correspond a `origin/main` au commit `26ae0be`.

Les briques existantes sont utiles mais separees :

- `fleet.ships`, `fleet.ship_sale_points` et un CSV statique de vehicules ;
- `fleet.items` et `fleet.item_categories`, geres manuellement ;
- `celestial_bodies` et `orbital_stations`, initialises par la migration V25 ;
- `utils.uex_dataset_cache`, qui remplace des blobs JSON dataset par dataset ;
- `utils.wikelo_ships`, remplace en bloc depuis une feuille Google Sheets ;
- des pages d'administration distinctes et aucun rescan global.

Le cache UEX actuel ne synchronise pas les tables metier. Il ne conserve pas non
plus la provenance de chaque valeur, les disparitions entre deux patchs, les conflits
entre sources ou les corrections manuelles.

## Sources retenues

### 1. Star Citizen Wiki API : identite et caracteristiques

Base : <https://api.star-citizen.wiki/api>

Cette API agrege les fichiers du jeu, le site RSI et les contributions du wiki. Elle
expose des UUID stables, la version du jeu, les caracteristiques detaillees et des
images avec leur source.

Volumes observes le 4 septembre 2026, version par defaut
`4.10.0-LIVE.12519617` :

| Route | Volume observe | Usage IceForge |
| --- | ---: | --- |
| `/vehicles` | 297 | vaisseaux, vehicules terrestres, gravlev et armures motorisees |
| `/items` | 12 283 | armes, armures, composants, modules, outils et objets divers |
| `/locations` | 1 970 | hierarchie des systemes et lieux du jeu |

Les listes utilisent `page[number]` et `page[size]`, avec 200 lignes maximum par
page. Un scan doit fixer la version au debut du traitement et envoyer un User-Agent
identifiable. Les projets publics doivent crediter l'API et Star Citizen Wiki.

Documentation :

- <https://api.star-citizen.wiki/developers>
- <https://docs.star-citizen.wiki/>
- <https://api.star-citizen.wiki/api/openapi>

### 2. UEX API 2.0 : disponibilite, terminaux et prix

Base : <https://api.uexcorp.uk/2.0>

UEX est prioritaire pour les donnees economiques. Les prix sont communautaires et
peuvent donc etre faux ou temporairement en retard ; la date, la version et la source
doivent toujours etre affichees.

Datasets a synchroniser :

- univers : `star_systems`, `planets`, `moons`, `orbits`, `cities`, `outposts`,
  `poi`, `space_stations`, `jump_points`, `terminals` ;
- vehicules : `vehicles`, `vehicles_purchases_prices_all`,
  `vehicles_rentals_prices_all` ;
- objets : `categories`, `categories_attributes`, `items_prices_all` ;
- donnees deja utilisees : commodites et raffineries.

`items_prices_all` relie les offres aux UUID Star Citizen. Les tarifs de vehicules
sont rapproches d'abord par UUID quand il existe, puis par alias de nom controle.
La limite documentee est de 14 400 requetes par jour et 10 par minute : le rescan
global doit etre asynchrone, cadence et non declenchable en parallele.

Documentation : <https://uexcorp.space/api/documentation?is_kiosk=1&set_lang=en_US>

### 3. Wikelo : offres et couts de missions

La feuille Google Sheets deja configuree reste la source Wikelo. Son contenu ne doit
plus etre limite aux vaisseaux : chaque offre devient un enregistrement versionne,
avec recompense, couts, quantites, reputation, texte de mission et URL source.

Le rapprochement se fait ainsi :

1. UUID explicite s'il devient disponible dans la feuille ;
2. nom normalise et table d'alias validee ;
3. conflit place dans une file de revue, jamais rattache automatiquement au hasard.

Une feuille vide ou illisible ne doit jamais vider les donnees Wikelo publiees.

### 4. Sources de secours

- Depot extrait des fichiers du jeu :
  <https://github.com/StarCitizenWiki/scunpacked-data>
- MediaWiki/pageimages pour completer une image manquante :
  <https://starcitizen.tools/Star_Citizen_Wiki:Application_programming_interface>

Ces sources ne remplacent pas l'API principale. Elles servent a diagnostiquer une
regression, completer une image ou verifier une valeur litigieuse.

## Perimetre d'exhaustivite

Toutes les lignes externes sont conservees dans la zone brute. Le catalogue public
utilise deux niveaux :

- **joueur** : objets nommes et utilisables, achetables, louables, obtenables en jeu
  ou necessaires a un gameplay ;
- **technique** : sieges, portes, controleurs, morceaux de vehicule, placeholders et
  autres entites internes, consultables uniquement dans l'administration.

Cette separation evite d'afficher des milliers de faux « modules » tout en gardant
une copie exhaustive et auditable de la source.

Categories publiques minimales :

| Famille | Regle principale |
| --- | --- |
| Vaisseau | vehicule avec `is_spaceship=true` |
| Vehicule terrestre | `is_vehicle`, `is_gravlev` ou categorie sol |
| Arme FPS | classification `FPS.Weapon.*` |
| Arme de vaisseau | classification `Ship.Weapon.*`, missiles, bombes et racks |
| Armure | classification `FPS.Armor.*` et combinaisons |
| Module/composant | classification `Ship.*`, hors armes et peintures |
| Outil | outils FPS, minage, salvage, tractor beam et gadgets utiles |
| Lieu | classification fournie par `/locations` |
| Point de saut | UEX `jump_points`, relie aux systemes origine/destination |
| Offre Wikelo | mission/recompense Wikelo reliee a une fiche catalogue |

Les peintures, vetements, consommables et objets de decoration sont conserves et
peuvent etre actives dans l'interface par filtre, sans polluer la vue initiale.

## Modele de donnees cible

Creer un schema PostgreSQL `catalog` au lieu d'etendre encore les tables historiques.

### Tables principales

- `catalog.entries` : identite canonique, famille, nom, fabricant, description,
  version, visibilite, donnees source et dates de premiere/derniere observation ;
- `catalog.external_ids` : correspondances UUID/ID entre Wiki, UEX, RSI et Wikelo ;
- `catalog.images` : plusieurs images, URL originale/miniature, dimensions, source,
  attribution, priorite et etat de validation ;
- `catalog.locations` : relation parent/enfant et type de lieu ;
- `catalog.offers` : achat, vente, location ou recompense Wikelo, montant, devise,
  duree, terminal, version et date de releve ;
- `catalog.wikelo_costs` : composants/ressources et quantites demandes ;
- `catalog.field_overrides` : correction manuelle par champ, auteur et justification ;
- `catalog.sync_runs` et `catalog.sync_issues` : progression, compteurs, erreurs,
  doublons, donnees orphelines et couverture des images.

Une entree n'est jamais supprimee parce qu'elle disparait d'un scan. Elle passe
`active=false` seulement apres un scan complet reussi de sa source. Les relations et
offres utilisent le meme principe.

### Priorite des valeurs

1. correction manuelle verrouillee ;
2. identite et statistiques des fichiers du jeu via Star Citizen Wiki API ;
3. prix et disponibilite UEX ;
4. description/image Wiki ;
5. valeur historique deja publiee ;
6. fallback de categorie.

Chaque valeur effective doit permettre d'afficher sa source, sa version et sa date.

## Strategie d'images

Ordre de selection :

1. image principale validee manuellement ;
2. miniature Star Citizen Wiki API ;
3. image UEX/RSI si une URL est fournie ;
4. recherche MediaWiki `pageimages` sur nom et fabricant ;
5. visuel local de la famille (`ship`, `weapon`, `armor`, `location`, etc.).

Le fallback garantit qu'aucune carte ne casse, mais le tableau de bord distingue une
image propre a l'objet d'un visuel generique. Les URLs distantes, dimensions, droits
et attributions sont stockes ; une tache verifie les liens morts sans telecharger ni
reheberger automatiquement des images dont les droits ne le permettent pas.

## Deroulement de « Rescanner tout »

1. refuser un second scan concurrent et creer `sync_runs` ;
2. lire et verrouiller la version Star Citizen cible ;
3. telecharger chaque page dans une zone de staging liee au run ;
4. valider le JSON, les volumes minimaux et les UUID ;
5. normaliser vehicules, items, lieux et images ;
6. cadencer les appels UEX, puis normaliser terminaux et offres ;
7. importer Wikelo sans supprimer l'ancien jeu de donnees ;
8. rapprocher les identites et enregistrer les conflits ;
9. calculer un diff (ajouts, modifications, disparitions, images manquantes) ;
10. publier atomiquement le run si les controles passent ;
11. appliquer les corrections manuelles au moment de construire la vue effective.

Le bouton lance le travail en arriere-plan et l'interface interroge son statut. Le
rapport final doit montrer les compteurs par famille et source, le patch importe, la
duree, les conflits et les fiches utilisant encore un fallback d'image.

## API et interface d'administration

Endpoints implementes :

- `POST /api/admin/catalog-sync/scrape-all` : actualise uniquement la zone brute ;
- `POST /api/admin/catalog-sync/scrape-and-map` : scrape et mappe le scope fourni ;
- `GET /api/admin/catalog-sync/current` : progression du dernier run.
- `GET /api/admin/catalog/entries` : consultation paginee du catalogue mappe,
  avec recherche, filtres de famille, etat, image, source et tri.

Scopes mappables : `VEHICLES`, `ITEMS`, `LOCATIONS`, `ECONOMY`, `WIKELO`.

La consultation paginee est disponible dans l'explorateur d'administration. La
correction champ par champ et l'historique detaille des fiches seront ajoutes avec
l'ecran public du catalogue ; ils ne sont pas necessaires au fonctionnement des deux
boutons de synchronisation.

L'ecran unique « Catalogue » remplace progressivement les pages data fragmentees. Il
contient le bouton **Rescanner tout**, la progression, les filtres de famille, une vue
des differences et une file « a verifier ». Les pages publiques continuent de lire
les anciennes tables jusqu'a validation, puis basculent famille par famille.

## Ordre d'implementation

1. migration `catalog`, runs, staging et import Star Citizen Wiki ;
2. tableau de bord et rescan asynchrone avec rapport ;
3. import UEX complet et offres achat/location ;
4. modele Wikelo normalise et rattachement aux fiches ;
5. corrections manuelles, images et file de revue ;
6. migration des vues publiques et retrait des anciens imports destructifs.

## Criteres d'acceptation

- un clic lance un seul run sans bloquer la requete HTTP ;
- un echec externe conserve integralement le catalogue publie precedent ;
- deux scans identiques ne creent aucun doublon ;
- toute fiche affiche une image ou un fallback identifie ;
- les prix indiquent lieu, type, devise, source, version et date ;
- une correction manuelle survit aux rescans suivants ;
- les disparitions sont desactivees, jamais effacees silencieusement ;
- Wikelo est inclus dans le bilan global et ne peut pas etre vide par un CSV vide ;
- le rapport separe catalogue joueur, donnees techniques et conflits a revoir.
