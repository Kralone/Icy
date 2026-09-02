# Promotion de sécurité V29

Cette procédure complète, sans la remplacer, la consolidation V1–V28 déjà
effectuée. Elle ne constitue pas une autorisation de déployer. Avant toute action
sur la production, il faut sauvegarder la base et tous les volumes de données
(notamment les images), vérifier les sauvegardes, puis répéter l'opération sur une
copie restaurée.

## Effet de V29

V29 ne cible que le triplet historique exact livré par V2 : nom `Kralone`, Discord
ID connu et hash BCrypt public resté inchangé. Dans ce seul cas, elle retire le rôle
ADMIN, désactive le compte, force la réinitialisation et remplace le hash par une
valeur aléatoire inutilisable. Si les identifiants ont déjà été légitimement
changés, la migration ne modifie pas le compte.

La migration est figée par le manifeste de checksums et a été validée localement
sur une base non vide sans historique Flyway : baseline V1, application V2–V29,
neutralisation, puis création d'un administrateur sain.

## Ordre obligatoire

1. Sauvegarder et vérifier PostgreSQL ainsi que chaque volume persistant.
2. Restaurer ces sauvegardes dans un environnement de répétition isolé.
3. Exécuter `verify-v29-admin-readiness.sql`. Il refuse de continuer sans autre
   administrateur actif ni si l'historique n'est pas exactement V1–V28.
4. Valider le démarrage du candidat sur la copie restaurée, puis exécuter
   `verify-flyway-v29.sql`.
5. Tester connexion admin, changement de mot de passe, rôles, frontend, bot,
   RabbitMQ, images et rollback applicatif sur cette copie.
6. Reproduire seulement ensuite la même séquence pendant une fenêtre de
   maintenance, avec le backend et le bot arrêtés pendant le gel des écritures.

`baseline-on-migrate` reste paramétrable par `FLYWAY_BASELINE_ON_MIGRATE`. Sa valeur
`true` est conservée uniquement pour l'enrôlement documenté du schéma V1 historique
sans table Flyway. Sur une production disposant déjà de V1–V28, la variable devra
être explicitement fixée à `false` dans le candidat et vérifiée sur la copie
restaurée.

Le script local `ops/admin/bootstrap-local-admin.ps1` est volontairement incapable
de cibler la production. Si le précontrôle ne trouve pas d'administrateur sain, la
promotion s'arrête : la création du compte de récupération sera préparée avec les
accès réels, après sauvegarde, et fera l'objet d'une procédure séparée et auditée.
