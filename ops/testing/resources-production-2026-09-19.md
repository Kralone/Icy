# Ressources : production du 19 septembre 2026

Release finale : `254b6c82625956e32e765ea85035d8cfaa2714a5`.

- V33 à V37 regroupées dans `V33__resources_catalogue.sql`, checksum Flyway `377288752`.
- Développement : sauvegarde puis migration normale V32 vers V33.
- Staging : sauvegarde complète et historique, empreinte de schéma comparée à la base locale, réconciliation transactionnelle des cinq anciennes lignes en une V33. V1 à V32 inchangées.
- Production : sauvegarde chiffrée complète et restauration PostgreSQL isolée vérifiée, puis migration normale V32 vers V33.
- Images backend, bot et frontend construites depuis une archive Git immuable, transférées avec contrôle SHA-256 et validées sur staging avant promotion.
- Build final : 247 tests backend, aucun échec ni erreur, 3 ignorés. Build frontend réussi. Tests ciblés frontend précédents : 3 réussis.
- Retour arrière applicatif testé sur staging : ancienne image de production V32 saine sur le schéma regroupé V33 ; image actuelle restaurée ensuite.
- Contrôles finaux : trois services production sains, version publique exacte, historique 33 migrations réussies, raffinage servi sous forme de tableaux JSON.
- Application locale alignée sur la même release ; backend et frontend sains.

## Reprise

- Sauvegarde production : `/var/backups/iceforge/iceforge-20260919T161110Z.tar.gz.age` et son checksum.
- Références applicatives avant première promotion : `/var/backups/iceforge/application-rollback.f0ZMSY`.
- Références avant correction finale d'encodage : `/var/backups/iceforge/application-rollback.acvsVb`.
- Sauvegarde staging avant regroupement : `/var/backups/iceforge-staging/resources-v33-20260919T160334Z/`.
- Sauvegarde locale avant regroupement : `.codex-tmp/resources-v33/local-before.dump`.

Le retour vers une ancienne image **staging contenant l'ancienne V33** exige aussi la restauration de l'ancien historique, backend arrêté. Cela diffère du retour applicatif vers l'ancienne image production V32, testé sur le nouveau schéma V33.

## Périmètre des données

Les données de production existantes sont conservées. Aucun scraping global de production n'a été déclenché par ce déploiement. Les 229 lieux Wiki et les 29 choix de variantes cités dans le rapport précédent concernent le staging ; la vérification publique production retrouve 188 lieux existants, 25 lignes de ressources pour les prix et 62 équipements miniers.

La revue indépendante du code, des contrôles de migration et de la correction finale d'encodage n'a relevé aucun blocage restant. La vérification visuelle complète desktop/mobile reste distincte des tests automatisés et des contrôles API réalisés.
