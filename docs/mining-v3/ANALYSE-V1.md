# Fiches de minage V1 : analyse

Analyse du code en place au 16/10/2026, qui a motivé la refonte. Code concerné :

- backend : `MiningSheetService` (1 355 lignes), `MiningSheetController`, entités `db/entity/mining`, migration `V27__create_mining_operations.sql` ;
- frontend : `features/utils/mining-sheets` (page principale de 1 316 lignes, plus les composants).

## Fonctionnement actuel

1. Un ADMIN crée une fiche : date, lieu de raffinage, lieu de vente, membres.
2. Chaque membre saisit des « jobs » de quatre types : raffinage (minerais en cSCU, méthode, durée, coût), carburant, réparation, matériel.
3. Un membre déclare un encaissement. Un même montant peut être réparti entre plusieurs fiches, au prorata de leurs estimations.
4. Le bilan calcule :
   - les recettes, réparties selon la valeur estimée (prix UEX) des minerais « à vendre » de chacun ;
   - les frais, partagés à parts égales puis compensés ;
   - les transferts « qui verse à qui ».
5. Un ADMIN verrouille, puis finalise.

## Problèmes constatés

| Problème | Effet pour les joueurs |
|---|---|
| Un « job » désigne à la fois un ordre de raffinage et une dépense, avec les mêmes champs. | Saisie confuse, écrans encombrés. |
| La contribution est attribuée à celui qui enregistre l'ordre de raffinage, pas à ceux qui ont miné. | Partage injuste quand une seule personne lance le raffinage pour l'équipage. |
| Recettes au prorata, frais à parts égales : deux règles différentes. | Personne ne peut refaire le calcul de tête. |
| Le partage réel dépend des prix UEX du moment ; un minerai sans prix sort de la pondération. | Le résultat change sans action des joueurs, et peut être faux. |
| Quatre onglets libres, bilan dans un bloc replié, verrouillage expliqué par un encart de texte. | On ne voit pas où en est la session ni qui doit agir. |
| Les transferts sont calculés, mais personne ne peut confirmer un paiement. | Les fiches ne se terminent jamais : les 5 fiches locales sont toutes ouvertes. |
| Onglet Logistique (vaisseaux, grilles cargo, environ 1 100 lignes) inaccessible depuis l'interface. | Code mort à maintenir. |
| Minerais en texte libre, quantités en cSCU. | Fautes de frappe, conversions mentales. |
| Aucun lien avec le module Opérations. | Participants ressaisis à la main. |
| Création, verrouillage et finalisation réservés aux ADMIN. | Un organisateur SPÉCIALISTE ou OFFICIER dépend d'un admin. |

## Décision

Ne pas corriger la V1. La repartir de zéro en V3, en gardant seulement le principe (participants, frais, ventes, partage, remboursements). Les données V1 ne sont pas reprises. Le détail est dans [SPEC.md](SPEC.md).
