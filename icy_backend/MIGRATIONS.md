# Politique des migrations Flyway

Les migrations décrivent l'historique d'une base, pas uniquement son état final. Une
migration qui a pu être exécutée sur un environnement partagé ou en production est
donc immuable : on ne la renomme pas, on ne la supprime pas et on ne modifie pas son
SQL. Une correction ultérieure prend une nouvelle version et avance le schéma.

## Règles pour les prochaines migrations

1. Rebaser la branche sur `main` avant de choisir le numéro, puis utiliser la version
   qui suit immédiatement la dernière migration présente. L'historique actuel se
   termine à V31 : la prochaine migration doit donc être V32.
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
- V29 : neutralisation conditionnelle du compte administrateur historique resté
  strictement inchangé depuis V2.
- V30 : alignement de la colonne de type des événements avec le modèle actuel,
  avec reprise des valeurs historiques et conservation nullable de l'ancienne
  colonne pour permettre un retour arrière applicatif.

Cette consolidation supprime le doublon V31/V37 et les allers-retours V23/V24 et
V41/V42. Un simple `flyway repair` est interdit sur l'ancien historique : il pourrait
marquer la nouvelle V28 comme appliquée sans créer `core.refresh_tokens`. La base de
production arrêtée à l'ancienne V43 suit la procédure transactionnelle décrite dans
`docs/PRODUCTION-BACKEND-JAVA25.md`. Toute autre variante d'historique doit être
analysée séparément et ne doit pas être réparée par analogie.

## Consolidation du catalogue après V29

L'ancienne série de développement V31 à V37 a été remplacée par une unique V31
transactionnelle. V30 reste l'alignement indépendant des événements. V31 crée le
catalogue final, importe le catalogue flotte historique, remet volontairement à
zéro les associations membres et supprime le stockage vaisseaux historique dans
la même transaction.

Le manifeste `src/test/resources/db/migration-history.sha256` verrouille V1 à V31.
Toute évolution de schéma doit désormais être ajoutée dans une nouvelle migration,
à commencer par V32.

Un environnement ayant déjà appliqué l'ancienne série V31-V37 ne doit pas lancer
un `flyway repair` aveugle. Après sauvegarde vérifiée et arrêt du backend, le script
`ops/production/backend-rollout/reconcile-flyway-v31.sql` contrôle l'état physique,
sauvegarde la table d'historique puis la ramène transactionnellement à V1-V31.

## Regroupement du module Opérations (V40 à V43)

Les migrations de développement V40 à V55 du module Opérations n'ont jamais été
appliquées en production ni en préproduction : les deux historiques, lus le
13 octobre 2026, s'arrêtaient à V38. Elles ont été remplacées par quatre migrations
qui créent directement le schéma final. V39 et les migrations antérieures ne sont
pas modifiées.

| Nouvelle migration | Contenu | Anciennes migrations de développement |
|---|---|---|
| `V40__create_operations_foundation.sql` | Type d'activité des événements, table des opérations, fonctions et déclencheurs de cohérence | V40, V41, V46, V47, V52, V53 |
| `V41__create_operation_organisation.sql` | Groupes et sous-groupes, responsable, affectations, demandes d'affectation | V42, V44, V45, V48 |
| `V42__create_operation_fleet.sql` | Besoins en vaisseaux, propositions, besoin lié et pilote | V43, V49, V50, V51 |
| `V43__create_operation_crews.sql` | Équipages de vaisseau : colonnes des groupes, postes, poste d'une affectation, presets | V54, V55 |

La contrainte unique créée par l'ancienne V44 puis retirée par l'ancienne V45 n'est
plus créée : seul l'index unique partiel « une demande en attente » existe.

Les documents et preuves rédigés avant ce regroupement citent l'ancienne
numérotation ; ce tableau donne la correspondance.

Une base ayant joué l'ancienne série refuse le nouveau code : checksums différents
pour V40 à V43 et versions appliquées sans fichier. Elle ne se corrige ni par
`flyway repair` ni par une retouche de `flyway_schema_history` : le module y est
reconstruit par les migrations regroupées, sur une copie, avant bascule.
