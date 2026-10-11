# Recettes Wikelo

## Source

Depuis le 6 octobre 2026, les recettes de vaisseaux et d’équipements viennent uniquement
de l’[API Star Citizen Wiki](https://api.star-citizen.wiki/developers) :
`/api/missions?filter[faction]=Wikelo%20Emporium`, puis `/api/missions/{uuid}?version=…`.
`WikeloMissionScraper` utilise la configuration existante `icy.catalog-sync`
(`wiki-base-url`, `wiki-version`, `user-agent`). La version du premier lot est conservée
pour les pages, les détails et les éventuelles récompenses demandées via l’API items.

Seuls les contrats publiés, hors `not_for_release` et `work_in_progress`, sont admissibles.
Les groupes de récompenses multiples, groupes désactivés et ingrédients alternatifs
ne sont pas présentés comme gains garantis. Les quantités, SCU et plages restent celles
de la source. Une erreur réseau, une pagination incomplète, un UUID dupliqué ou une
quantité invalide arrête l’import avant le remplacement des offres publiées.

## Vaisseaux

`WikeloShipRecipeScraper` sélectionne les missions « Wikelo - Vehicles » et relie
les récompenses aux données véhicules du catalogue par UUID exact. Le nom affiché et
le fit viennent de cette variante, jamais d’un modèle standard supposé équivalent.
Le fit utilise le même lecteur de ports que le hangar. Les pièces d’armure et armes
d’un lot, comme celui du Wolf, restent des récompenses supplémentaires distinctes.

Le Pulse Wikelo est identifié comme véhicule par `/api/items/{uuid}` lorsqu’il est
absent du dataset véhicules. Sa recette est importée ; les caractéristiques techniques
absentes ne sont pas remplacées par celles du Pulse standard.

Chaque offre conserve `missionId`, `rewardUuid`, `sourceVersion`, `sourceUrl` et
`scrapedAt`. Deux contrats pour le même modèle restent deux offres distinctes.
Le pipeline admin stocke les offres dans `WIKELO/offers`, avec une clé mission/récompense,
puis les publie dans `utils.wikelo_ships`. La reprise après revue utilise ce snapshot.

La migration V39 retire les anciennes offres et données brutes importées depuis
la source abandonnée, supprime `source_sheet` et ajoute les champs API. Elle ne modifie
pas les objectifs utilisateurs. Un nouvel import admin Wikelo est nécessaire après
application de cette migration pour publier les recettes API.

## Équipements

`WikeloEquipmentRecipeScraper` utilise le même client de missions. Les contrats sont
stockés dans `WIKELO/equipment_recipes`, puis publiés dans `catalog.wikelo_equipment_recipes`.
Les récompenses sont reliées aux équipements par nom exact. Chaque pièce d’un ensemble
présente le coût complet du contrat et toutes ses récompenses.

Le référentiel d’affiliation historique `WikeloEquipmentCatalog.VERIFIED_NAMES` permet
encore de consulter les objets connus sans recette admissible. Il ne crée aucune recette
et n’affirme pas leur disponibilité au patch courant.

## Validation

Les fixtures `missions-api-4.10.1.json` et `vehicles-api-4.10.1.json` proviennent des
réponses publiques du 6 octobre 2026, version `4.10.1-LIVE.12660092`. Seuls les champs
nécessaires au parseur sont conservés. Elles couvrent les 87 missions, 42 offres de
véhicules, les 20 ingrédients du Polaris et de l’Idris, le fit F8C et les bonus Wolf.
`pulse-item-api-4.10.1.json` conserve l’identification explicite du Pulse par l’API items.
Les fixtures d’équipements 4.10.0 restent utilisées pour vérifier la compatibilité du parseur.

Les objectifs créés depuis une recette conservent les quantités en SCU et les unités
d’objets. Une quantité absente, fractionnaire ou exprimée en plage exige un objectif
manuel ; elle ne devient pas arbitrairement une quantité de un.

Validation locale : 36 tests backend sous Java 25, 30 tests Angular et build de
production réussis. V39 passe sur PostgreSQL 18.6 avec une copie du schéma local :
objectif existant inchangé, anciennes offres et snapshots retirés, plusieurs contrats
pour un même modèle acceptés, doublons mission/récompense refusés.
Un import réseau réel, exécuté par le nouveau code sous Java 25 sans écriture en base,
confirme les 42 offres de cette version, les bonus Wolf et le constructeur Mirai du Pulse.
