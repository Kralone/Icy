# Fiches de salvage

Les fiches de salvage reprennent les fiches de minage (`docs/mining-v3/SPEC.md`) : mêmes participants, frais, ventes,
partage, versements et historique. Seules la collecte et le vocabulaire changent.

## Le salvage en 4.10.3 (recherche)

| Méthode | Vaisseaux | Produit | Suite |
| --- | --- | --- | --- |
| Grattage de coque (hull scraping) | Salvation, Vulture, Fortune, MOTH, Reclaimer, multitool Cambio | **RMC** (Recycled Material Composite) | Vente directe, pas de raffinage |
| Démantèlement (fracture / disintegrate) | Salvation, Vulture, Fortune, MOTH, Reclaimer | **Construction Rubble** (Salvation, Vulture, Fortune), **Construction Pieces** (MOTH), **Construction Salvage** (Reclaimer) | Ordre de raffinage, durée, donne du **CMAT** (Construction Materials) |
| Composants | tous | armes, boucliers, générateurs démontés | Vente hors UEX |

- **Prix relevés** : RMC autour de 7,7 k à 8,9 k aUEC/SCU (Terra Mills, Seer's Canyon, Rustville, Patch City),
  CMAT autour de 13 k aUEC/SCU (Everus Harbor, Port Tressler, ARC-L1). La fiche prend les prix UEX en direct.
- **Tampons de salvage relevés en 4.10.3** (chiffres PTU) : Vulture 13→16, Reclaimer 240→448, MOTH 64→240,
  Fortune 13→14, Salvation 6→8 SCU.
- **Pas de qualité** : contrairement au minerai, le matériau de salvage n'a pas de qualité.
- **Frais** : claim de récupération Adagio Holdings (environ 100 k aUEC pour un contrat de démantèlement), location
  de vaisseau, carburant, réparations.

Sources : elyxir.gg, starzen.space, theimpound.com, starshipdealers.com, expcarry.com.

## Modèle

Une fiche porte une activité, `MINING` ou `SALVAGE` (`session.sheets.activity`, prévue dès la v3 pour cet usage).

Un lot de cargo (`mining.refinery_orders`) a un type :

- `REFINERY` : un ordre de raffinage, comme au minage. Ses lignes disent ce qui sort de la raffinerie : sur une
  fiche de salvage, uniquement du CMAT (Construction Materials), sans qualité. Le RMC et le matériau brut sont refusés
  (écran et serveur) : ils se déclarent en cargaison.
- `HAUL` : une **cargaison**. C'est ce qui a été récupéré à bord, avec un lieu libre (le vaisseau ou la station),
  sans terminal, sans méthode, sans durée. Elle est prête dès sa saisie, n'est jamais annoncée sur Discord comme un
  raffinage terminé et, gardée par son détenteur pour qu'il la vende lui-même, elle est remise d'office.

Une fiche de salvage accepte aussi une **vente directe**, sans ligne de marchandise : composants démontés,
récompense de contrat. Une fiche de minage la refuse toujours.

Nouveaux frais : `CLAIM` (claim de récupération) et `RENTAL` (location de vaisseau), proposés seulement au salvage.

Étapes : Récupération (`SALVAGING`), Raffinage, Remise du cargo, Vente, Versements, Terminée.

Les matériaux de salvage sont repérés dans le cache UEX par leur nom (RMC, Construction Materials/Rubble/Pieces/Salvage,
Scrap). Le minerai est refusé sur une fiche de salvage et l'inverse.

Une opération peut créer sa fiche liée avec l'option « Session de salvage », exclusive de « Session de minage »
(une opération a au plus une fiche).

## Livraison

- Migration `V53__salvage_sessions.sql`, additive : aucune donnée existante n'est modifiée.
- Pages : `/icy/outils/fiches-salvage` et `/utilitaires/fiches-salvage`, carte dans le menu Outils et le pôle Industrie.
- Discord : mêmes messages et clés de routage `mining.*` ; seul le lien pointe vers la fiche de salvage. Le bot ne
  change pas.
- Pôle Industrie : ses chiffres et ses dernières fiches couvrent le minage et le salvage.
- Discord : le pied du message dit « Fiche de salvage » ou « Fiche de minage » (champ `footer`, facultatif pour le bot).
- Livraison : `verify-flyway-v53.sql` (historique V1-V53, checksum V53 909741628, structures V53), le déploiement de
  production vise V53. Une base en V52 passe en V53 avec une sauvegarde fraîche, comme toute migration.
