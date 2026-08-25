# Politique des migrations Flyway

Les migrations décrivent l'historique d'une base, pas uniquement son état final. Une
migration qui a pu être exécutée sur un environnement partagé ou en production est
donc immuable : on ne la renomme pas, on ne la supprime pas et on ne modifie pas son
SQL. Une correction ultérieure prend une nouvelle version et avance le schéma.

## Règles pour les prochaines migrations

1. Rebaser la branche sur `main` avant de choisir le numéro, puis utiliser la version
   qui suit immédiatement la dernière migration présente. L'historique actuel se
   termine à V28 : la prochaine migration doit donc être V29.
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

## Consolidation après V20

V1 à V20 constituent la partie historique conservée et immuable. L'ancienne série
V21 à V44 a été ramenée à huit migrations cohérentes :

- V21 : identité, profils, rôles et notifications ;
- V22 : flotte, catalogue d'objets et points de vente ;
- V23 : modèles et participations aux objectifs ;
- V24 : fonctionnalités utilitaires, Wikelo, Executive Hangar et cache UEX ;
- V25 : catalogue des corps, stations et lieux de minage Star Citizen ;
- V26 : veille CIG et traductions ;
- V27 : opérations de minage ;
- V28 : refresh tokens.

Cette consolidation supprime le doublon V31/V37 et les allers-retours V23/V24 et
V41/V42. Elle ne doit être réparée sur une base existante que si cette base possède
déjà l'ancien historique complet jusqu'à V44. Avant tout `repair`, effectuer une
sauvegarde et vérifier que les 44 entrées sont réussies. Une base arrêtée entre V21 et
V43 ne doit pas être réparée avec le nouvel historique.

Le manifeste `src/test/resources/db/migration-history.sha256` verrouille V1 à V28.
Toute évolution de schéma doit désormais être ajoutée dans une nouvelle migration,
à commencer par V29.
