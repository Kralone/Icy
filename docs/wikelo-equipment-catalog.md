# Équipements Wikelo

Vérification du 10 septembre 2026. Le catalogue local possède les modèles et images ; le scrape Google Sheets lit l’onglet vaisseaux (`shipsGid`/`shipsSheetName`, blocs `#` et `Component`). Le nouvel import API versionné décrit ci-dessous complète désormais les recettes d’équipement.

`WikeloEquipmentCatalog.VERIFIED_NAMES` est un référentiel d’affiliation limité, joint par nom exact aux équipements actifs du catalogue Wiki. Il ne crée aucun objet absent et ne déduit aucune recette. Une description technique sans « Wikelo » n’exclut plus les récompenses connues. Les variantes voisines ne sont pas automatiquement incluses.

## Provenance

- [Tables de contrats Wikelo](https://starcitizen.tools/Wikelo#Contracts), maintenues par Star Citizen Wiki : Testudo Clanguard, Strata Heatwave, Palatino Mark I, Corbel Crush avec sac Novikov Crush, Bokto, BUL-H4 Snow Camo et son porte-munitions, Geist Snow Camo ; armes Clanguard, Heatwave, Snow Camo, Irradiated et Yormandi.
- [Catégorie Wikelo rewards](https://starcitizen.tools/index.php?title=Category:Wikelo_rewards&oldid=317554) : Ana Endro (alias catalogue sans « Armor »), DCP Cobalt/Hunter/Jungle Camo, Venture Ascension, armes Ascension, F55 Mark I, Fresnel Deepwater, Quartz Camo et quatre Parallax Fun. La catégorie appartient au wiki communautaire, pas à CIG.
- Les trois armes « Quite Useful » déjà affichées sont conservées comme équipements explicitement attribués à Wikelo dans leur description de jeu importée : [GP-33](https://starcitizen.tools/GP-33_MOD_%22Quite_Useful%22_Grenade_Launcher), [Scourge](https://starcitizen.tools/Scourge_%22Quite_Useful%22_Railgun), Animus (description locale). Cela ne prouve pas une recette actuellement disponible : aucune condition d’échange n’est annoncée.

La veste Wikelo Emporium Jacket est exclue : son thème seul ne prouve pas une récompense d’échange ; elle figure comme article d’abonnement dans le [référentiel des abonnements](https://starcitizen.tools/Subscriber_Store). Les objets décoratifs, monnaies et variantes non vérifiées restent exclus.

## Limites et maintenance

Contrôle des images du 10 septembre 2026 : 19 équipements affichés n’ont ni image dans l’API source (`images: []`), ni image principale sur leur page Wiki exacte. Aucune variante voisine ne leur est substituée. Les correspondances explicites des noms abrégés des vaisseaux sont maintenues dans `WikeloComponent` avec séparation des variantes militaires et furtives.

Parmi les 34 offres de vaisseaux, 29 images dédiées répondent en HTTP 200. Cinq variantes renvoient également `images: []` dans l’API véhicules : F8C Lightning Wikelo Sneak Special, L-21 Wolf Wikelo War Special, L-21 Wolf Wikelo Sneak Special, Guardian MX Wikelo War Special et Meteor Wikelo Sneak Special. Le visuel de secours du catalogue est traité comme une absence d’image dans Wikelo.

L’export Google Sheets impose `headers=0` : sans ce paramètre, Google fusionne ses en-têtes supposés et peut importer la ligne de crédits comme préfixe du premier nom de vaisseau (cas Golem). Les crédits restent dans la source ; ils ne deviennent plus des données de vaisseau.

Couverture partielle, sans garantie d’exhaustivité ni de disponibilité au patch courant. Les objets sont présentés par pièce, pas comme ensembles complets garantis. L’API conserve les descriptions, images et liens techniques du catalogue ; ces liens décrivent le modèle, tandis que les sources ci-dessus justifient son affiliation.

Pour étendre la couverture historique, vérifier une récompense dans une table de contrats ou une source de jeu, ajouter son nom exact et documenter la source. Tester aussi l’exclusion de la variante standard. Le jeu de contrats distinct décrit ci-dessous étend automatiquement la couverture par les récompenses exactes, sans recherche textuelle dans les descriptions.

## Recettes synchronisées

Le pipeline admin collecte désormais les contrats d’équipement via `WikeloEquipmentRecipeScraper` en plus de l’onglet vaisseaux. Le scope Wikelo et la synchronisation complète enregistrent d’abord `WIKELO/equipment_recipes` dans `catalog.raw_records`, puis publient une version validée dans `catalog.wikelo_equipment_recipes` (migration V32). Une reprise après revue utilise les données brutes déjà enregistrées. Un résultat vide, un identifiant dupliqué ou une récompense incomplète arrête cette étape ; la publication précédente reste consultable.

Le champ API `recipes` est une liste, vide lorsqu’aucun contrat publié ne correspond. Chaque recette conserve nom, réputation, source, version, ingrédients et récompenses. Les quantités restent textuelles pour garder les unités. Les récompenses enrichissent aussi la sélection des objets au-delà du référentiel initial, uniquement par correspondance de nom exact ; les lignes de blueprint ne deviennent pas des équipements. Les ingrédients et conditions ne sont jamais déduits du prix marchand ni de la description d’un objet.

Chaque publication conserve les identifiants existants et désactive les contrats absents de la nouvelle version validée. Les anciennes descriptions d’affiliation ci-dessus restent un secours pour les équipements dont la recette n’est pas publiée. Elles ne constituent pas une garantie de disponibilité au patch courant.

## Import des recettes (10 septembre 2026)

Le traitement admin Wikelo importe désormais les recettes depuis l’API versionnée du Wiki : `/api/missions?filter[faction]=Wikelo%20Emporium`, puis `/api/missions/{uuid}?version=…`. La version du premier lot est conservée pour tous les détails et pages suivants. Le Google Sheet reste la source des offres vaisseaux.

Les recettes d’équipement sont stockées séparément dans les données brutes `WIKELO/equipment_recipes`, puis publiées dans `catalog.wikelo_equipment_recipes`. Une erreur réseau, un lot vide ou une quantité invalide empêche le remplacement de la publication précédente. La synchronisation admin Wikelo, la synchronisation complète et la reprise du mapping utilisent ce circuit.

La liaison utilise le nom exact de chaque récompense avec le catalogue actif. Les contrats peuvent ajouter de nouvelles variantes à la liste d’affiliation historique ci-dessus. Chaque pièce d’un ensemble présente les ingrédients de tout le contrat et toutes ses récompenses, afin de ne pas laisser croire que le coût affiché achète seulement cette pièce.

Seuls les contrats marqués `released`, hors `not_for_release` et `work_in_progress`, sont importés. Les groupes de récompenses multiples/aléatoires, groupes désactivés et ingrédients alternatifs ne sont pas publiés comme recettes garanties. Les quantités SCU et plages sont conservées. Les équipements historiques sans contrat admissible restent consultables avec conditions indisponibles ; leur présence n’affirme pas leur disponibilité au patch courant.

Source et schéma : https://api.star-citizen.wiki/developers et https://raw.githubusercontent.com/StarCitizenWiki/API/develop/swagger.yaml. Exemple de validation : https://api.star-citizen.wiki/missions/armor-with-horn-and-string (Ana Endro, cinq ingrédients pour quatre pièces, version 4.10.0-LIVE.12519617). Les anciennes pages éditoriales peuvent différer des données de jeu ; elles ne servent pas de repli automatique aux recettes courantes.

### Poids absent et couverture vérifiée

Audit des 87 contrats publics le 10 septembre 2026, version `4.10.0-LIVE.12519617` : 69 sont publiés. Parmi eux, 18 ont un groupe unique de poids positif, 48 un groupe unique sans poids renseigné, un un poids explicitement nul (`0`), et deux plusieurs groupes alternatifs. Le schéma autorise `weight: null` et décrit `0` comme désactivé. L'ancien appel `asDouble()` assimilait à tort l'absence de poids à zéro. Le parseur accepte désormais le groupe unique sans poids, tout en rejetant les groupes explicitement désactivés et les alternatives. Un poids de type invalide bloque l'import.

Validation du parseur corrigé sur les 87 réponses complètes : **66 contrats acceptés, 21 exclus, aucune erreur**. Sur les équipements du catalogue local, les correspondances exactes passent de **9 à 11 armes sur 23** ; elles restent à **43 pièces d'armure sur 63**. Ces nombres décrivent la couverture après un nouvel import, pas une mise à jour automatique de la publication existante. Les nouveaux contrats couvrent le Fresnel « Yormandi » et le Parallax « Fun Kopion Skull » ; les vingt batteries du second restent visibles parmi ses récompenses. Les fixtures de ces deux réponses publiques sont conservées dans `src/test/resources/wikelo` et les six tests du scraper passent.

Réponses sources : [Yormandi Gun](https://api.star-citizen.wiki/api/missions/8df7d9a9-c887-4302-b93c-863788bdca01?version=4.10.0-LIVE.12519617), [Fun Kopion Skull Gun](https://api.star-citizen.wiki/api/missions/31f004c2-9b77-4a0f-a500-89f89b606a96?version=4.10.0-LIVE.12519617).

L'Animus « Quite Useful » n'apparaît dans aucune récompense des 87 contrats de cette version, y compris ceux non publiés. La [page historique Need Ore. Will give Guns.](https://starcitizen.tools/Need_Ore._Will_give_Guns.) décrit un tirage entre trois armes ; elle ne démontre pas une recette actuelle ni un gain garanti. Ses anciennes conditions ne sont donc pas réinjectées. Le catalogue continue à afficher cet équipement avec conditions indisponibles.


### Idris-P : recette multiligne

Vérification du 10 septembre 2026 dans le [tableau source vaisseaux](https://docs.google.com/spreadsheets/d/1ji0q_pp6iW35RG1YyFEsv-lsmZOaCStJXGdIEdLLwhM/edit#gid=481073732) : la cellule C110 contient réputation et cinq ingrédients ; J105 annonce « Idris Costs Continued: », avec quinze ingrédients supplémentaires en J106. Le parseur perdait les retours à la ligne après les faveurs et ignorait la suite latérale. Il sépare maintenant les champs multiligne et rattache uniquement une suite explicitement nommée, sans absorber les notes voisines. Une suite annoncée mais absente, invalide ou ambiguë fait échouer la collecte pour conserver la publication précédente.

La recette complète contient 50 de chacun des éléments suivants : Wikelo Favor, Polaris Bit, DCHS-05 Orbital Positioning Comp-Board, Carinite, Irradiated Valakkar Fang (Apex), MG Scrip, Ace Interceptor Helmet ; 30 de chaque : Irradiated Valakkar Pearl (Grade AAA), UEE 6th Platoon Medal (Pristine), Carinite (Pure), ASD Secure Drive ; puis 5 de chacune des neuf variantes RCMBNT PWL/RGL/XTL, niveaux 1/2/3. Réputation indiquée : Very Best Customer (999 Reputation). Les noms et quantités proviennent du tableau, sans conversion ni substitution.

Le snapshot public complet `ships-current.csv` teste les 34 offres et les vingt ingrédients exacts de l'Idris-P, ainsi que le refus d'une suite non associée. Les champs coût/réputation sont aussi testés dans l'ordre inverse. La publication existante nécessite un nouvel import admin pour bénéficier de la correction.
