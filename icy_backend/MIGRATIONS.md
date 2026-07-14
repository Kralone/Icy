# Politique des migrations Flyway

Les migrations décrivent l'historique d'une base, pas uniquement son état final. Une
migration qui a pu être exécutée sur un environnement partagé ou en production est
donc immuable : on ne la renomme pas, on ne la supprime pas et on ne modifie pas son
SQL. Une correction ultérieure prend une nouvelle version et avance le schéma.

## Règles pour les prochaines migrations

1. Rebaser la branche sur `main` avant de choisir le numéro, puis utiliser la version
   qui suit immédiatement la dernière migration présente.
2. Regrouper dans une version une évolution métier atomique et cohérente. Ne pas
   regrouper plusieurs fonctionnalités sans rapport sous prétexte qu'elles arrivent
   dans la même livraison.
3. Tant qu'une migration n'a jamais quitté sa branche, intégrer ses corrections dans
   cette migration. Dès qu'elle a été exécutée sur un environnement partagé, ajouter
   une migration corrective `Vn+1`.
4. Ne pas employer `IF NOT EXISTS` pour cacher une collision de versions ou un ordre
   incorrect. Son usage doit correspondre à une compatibilité explicitement voulue.
5. Ne pas recopier une migration ou un backfill existant. Le test
   `MigrationHistoryTest` détecte les doublons de SQL.
6. Tester les deux chemins avant fusion : création d'une base vide et mise à niveau
   d'une base contenant tout l'historique déjà livré. Le démarrage doit aussi passer
   avec `spring.jpa.hibernate.ddl-auto=validate`.
7. Après chaque livraison en production, ajouter au manifeste de checksums les
   migrations nouvellement livrées et avancer `LOCKED_THROUGH_VERSION` dans le test.

## Anomalies historiques conservées

Certaines versions antérieures à la mise en place de ce contrôle ne sont pas idéales,
mais les réécrire casserait les checksums Flyway des bases qui les ont déjà exécutées :

- V23 ajoute `goals.goal_templates.user_id`, puis V24 le supprime. C'est un aller-retour
  historique, désormais sans effet sur le schéma final.
- V31 et V37 contiennent exactement le même SQL. V37 est inutile sur une base neuve,
  mais doit rester présente pour préserver l'historique déjà appliqué.
- V41 crée `fleet.ship_cargo_grids.grid_name`, puis V42 supprime la colonne. Cette
  correction reste séparée parce que les deux versions sont déjà dans l'historique.

Des branches anciennes ont également utilisé les numéros V41 à V43 pour des tables de
guides et d'alias avant qu'une autre série V41 à V43 ne soit fusionnée. Ces tables ne
font pas partie du schéma requis par le code actuel : une base neuve démarre sans elles.
Elles ne doivent toutefois pas être supprimées automatiquement d'une base existante,
car certaines installations peuvent encore contenir des données à conserver.

Le manifeste `src/test/resources/db/migration-history.sha256` verrouille V1 à V43.
V44 reste modifiable tant qu'elle n'a pas été livrée en production ; après livraison,
elle devra être ajoutée au manifeste et la borne du test devra passer à 44.
