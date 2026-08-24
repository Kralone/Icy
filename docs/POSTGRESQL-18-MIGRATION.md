# Migration PostgreSQL 15.19 vers 18.6

Ce runbook décrit la bascule de production d'IceForge vers PostgreSQL 18.6. Il
complète le changement Compose ; il ne doit pas être remplacé par un simple
`docker compose up`.

## Cible et invariants

- source : PostgreSQL 15.19, image et volume `postgres_data` conservés ;
- cible : PostgreSQL 18.6 Bookworm, digest
  `sha256:7d2695c3aa88e792e8b3b233e7e4adb296a20412c6c0ca361e3edaaacfada108` ;
- volume cible : `postgres18_data:/var/lib/postgresql` ;
- données réelles : `/var/lib/postgresql/18/docker` dans le volume cible ;
- méthode : dump logique avec les outils 18.6, puis restauration dans une base
  18.6 vierge ;
- interdiction : ne jamais monter le volume binaire 15 dans PostgreSQL 18, ni
  démarrer PostgreSQL 15 sur le volume 18.

Le volume 15 reste intact jusqu'à la fin de la fenêtre d'observation. Un backup
hors hôte, chiffré et restauré avec succès, reste obligatoire : un volume Docker
n'est pas une sauvegarde.

## Préparation et go/no-go

Relever sans exposer de secret : version exacte, taille de la base, espace libre,
extensions et versions, locale/collation, propriétaires, schémas, nombre de
tables et de lignes métier, séquences, connexions, transactions longues et
durée du dernier backup. Prévoir au moins l'espace pour la source, la cible, le
dump et leur marge de croissance.

Le go est interdit si l'un des points suivants manque :

- dump récent et checksum stockés hors de l'hôte ;
- restauration complète répétée sur une cible 18.6 ;
- durée mesurée compatible avec la fenêtre de maintenance ;
- accès au volume et à l'image 15.19 pour le rollback ;
- procédure de gel des écritures et vérification qu'elles sont réellement
  arrêtées ;
- contrôles métier convenus avec un responsable du site.

## Répétition

Utiliser `pg_dump` 18.6 pour lire la source 15.19. Fournir le mot de passe par un
fichier protégé ou un secret temporaire, jamais dans l'historique du shell.
Produire un dump custom avec `--format=custom --no-owner --no-acl`, calculer son
checksum, puis inspecter son catalogue avec `pg_restore --list`.

Cette combinaison restaure tous les objets sous le rôle de connexion cible et
convient au déploiement IceForge à rôle applicatif unique. Si l'inventaire réel
trouve plusieurs propriétaires, rôles ou ACL métier, ne pas les supprimer :
exporter séparément les rôles/globaux avec `pg_dumpall --globals-only`, revoir le
plan avec l'administrateur et tester les permissions effectives après
restauration.

Démarrer la cible 18 seule sur un réseau isolé, avec un volume neuf monté sur
`/var/lib/postgresql`. Restaurer avec `pg_restore --no-owner --no-acl
--exit-on-error`. Comparer au minimum :

1. schémas, tables et colonnes avec types, défauts et nullabilité ;
2. contraintes validées, index, séquences et propriétaires ;
3. extensions et leurs versions, en particulier `pgcrypto` ;
4. les 28 lignes de `public.flyway_schema_history` et leurs checksums ;
5. le nombre de lignes de chaque table et des agrégats métier stables ;
6. les identifiants sentinelles choisis avant le dump.

Un dump logique peut compacter l'ordre physique d'une table ayant eu une colonne
supprimée et PostgreSQL 18 matérialise les `NOT NULL` dans `pg_constraint`. Les
contrôles doivent donc comparer la sémantique des colonnes et contraintes, pas
les OID ni le rendu textuel brut du catalogue.

## Bascule de production

1. annoncer la maintenance et arrêter les écritures applicatives ;
2. vérifier l'absence de transaction d'écriture et noter l'heure de coupure ;
3. produire le dump final 15.19 et son checksum ;
4. démarrer uniquement PostgreSQL 18 sur `postgres18_data` ;
5. restaurer le dump final et exécuter tous les contrôles de la répétition ;
6. reconstruire les statistiques avec `vacuumdb --analyze-in-stages` ;
7. démarrer le backend, puis vérifier Flyway v28, Hibernate, le pool Hikari,
   l'API publique, l'authentification et RabbitMQ ;
8. démarrer le bot et le frontend, puis exécuter les scénarios métier retenus ;
9. rouvrir les écritures seulement après le go explicite ;
10. surveiller erreurs, connexions, latence, verrous, disque et logs pendant la
   fenêtre d'observation.

Après recréation du conteneur cible, vérifier que PostgreSQL journalise la
présence de la base existante et que les données sentinelles sont toujours là.
Cela valide le nouveau point de montage et évite une base éphémère.

## Rollback

Avant la réouverture des écritures sur 18, arrêter les services, revenir au
commit précédent et redémarrer PostgreSQL 15 sur `postgres_data`. Aucun downgrade
de volume n'est nécessaire, car la source n'a pas été modifiée.

Après la première écriture sur 18, le retour à la source 15 figée perdrait ces
nouvelles écritures. Le choix doit alors être explicite : accepter cette perte,
rejouer les écritures depuis un journal fiable, ou appliquer une stratégie de
réplication inverse préparée et testée avant la bascule. Sans l'une de ces
options, arrêter les écritures et corriger sur 18 est plus sûr qu'un rollback
improvisé.

Ne supprimer `postgres_data`, le dump final et le backup hors hôte qu'après la
durée de rétention décidée et une validation métier formelle.

## Résultat de la répétition locale

Le 24 août 2026, le dump de test faisait 134 777 octets et a pris 626 ms ; la
restauration a pris 967 ms. Les 13 schémas, 49 tables, 365 colonnes, 129
contraintes applicatives, 21 séquences, 120 index, 28 migrations Flyway et le
contenu exact des 112 lignes de test correspondaient. `pgcrypto` est passé de
1.3 à 1.4 et ses fonctions ont répondu. Le backend Spring Boot 4.1.1 a servi
l'API en HTTP 200 sur PostgreSQL 18.6, avec RabbitMQ actif ; les 108 tests Maven
ont réussi. La cible a persisté après recréation et la source 15.19 est restée
lisible comme point de rollback.

Ces nombres décrivent uniquement le jeu local. Ils ne constituent pas les
seuils attendus en production.

## Références officielles

- [changement de `PGDATA` de l'image Docker officielle](https://github.com/docker-library/docs/blob/master/postgres/content.md#pgdata) ;
- [mise à niveau d'une version majeure PostgreSQL](https://www.postgresql.org/docs/18/upgrading.html) ;
- [`pg_dump`](https://www.postgresql.org/docs/18/app-pgdump.html) et
  [`pg_restore`](https://www.postgresql.org/docs/18/app-pgrestore.html).
