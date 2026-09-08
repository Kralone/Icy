# Bascule du catalogue des vaisseaux

Le catalogue canonique est l'unique source de vaisseaux apres V36.

## Etat retenu

- V35 ajoute aux entrees catalogue les champs utilises par les flottes.
- V36 vide volontairement les acquisitions, les favoris et les associations
  mining existantes.
- V36 supprime `fleet.ships`, `fleet.ship_sale_points` et
  `fleet.ship_cargo_grids`.
- Les nouvelles flottes ciblent directement `catalog.entries`.
- Des vues de compatibilite conservent temporairement le contrat Java/JSON du
  backend pendant le retrait progressif des anciens ecrans et types.

Les scripts `00-import-missing-legacy-ships.sql` et
`01-verify-canonical-catalog.sql` documentent l'import deja effectue et la
verification du catalogue avant bascule. Le script
`copy-production-catalog-to-staging.sh` ne copie que les donnees publiques du
catalogue.

Cette migration est destructive pour les flottes constituees par les membres.
Elle doit toujours etre precedee d'une sauvegarde restauree et validee.
