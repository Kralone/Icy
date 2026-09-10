# Lot interface et catalogue — V32

Une seule migration est livrée après la V31 de staging et de production :
`V32__interface_catalogue_and_publication.sql`.

Elle regroupe la publication CIG, les recettes Wikelo, les images d’actualités,
les capacités cargo/minerai, les associations MISC strictes et les corrections
manuelles persistantes du catalogue. Les migrations intermédiaires V32 à V37
avaient uniquement été appliquées sur la base de développement locale ; elles
n’ont jamais été publiées. Cette base a été sauvegardée avant consolidation.
Aucun historique Flyway distant n’est réécrit.

Vérifications avant promotion : suite backend, suite Angular, tests SQL réels
sur une base isolée, contrôle visuel desktop/mobile et test CIG jusqu’au message
Discord puis à son accusé de réception en base. Le test minage local crée deux
fiches DEMO, déclare les avances avec deux comptes, puis vérifie montants et
virements après vente sans clôture automatique.

La staging conserve les publications automatiques et le relais Discord désactivés.
En production, les secrets et identifiants Discord existants sont conservés.
LibreTranslate assure la traduction sans OpenAI ; une correction française
manuelle reste possible avant publication.

La promotion utilise les mêmes images immuables en staging et en production,
précédée d’une sauvegarde chiffrée et d’une restauration PostgreSQL de contrôle.

## Déploiement du 10 septembre 2026

- Images applicatives staging et production : `f43e7ba67d9bd8b49678e447ebbdb2183d109cb1`.
- Correctif de configuration des noms de conteneurs production : `f462ff3`.
- Migration V32 et contrôles runtime réussis dans les deux environnements.
- Production : frontend, backend, bot et LibreTranslate sains ; site et API publiques HTTP 200.
- Sauvegarde chiffrée : `/var/backups/iceforge/iceforge-20260910T144356Z.tar.gz.age`, checksum vérifié ; dump restauré avec inventaire comparé avant chiffrement.
- CIG : publication et relais activés, uniquement Comm-Link officiel ; ancien rapport Spectrum/Reddit désactivé. Aucun contenu non officiel marqué pour publication automatique lors du contrôle final.
- Staging : synchronisation Wikelo 8 réussie, 34 vaisseaux et 86 équipements.
- Production : actualisation du catalogue encore en attente d’une session administrateur normale. Le contrôle final trouve 34 vaisseaux, 73 équipements et aucune recette publiée. La synchronisation admin Wikelo doit être exécutée pour publier les nouvelles recettes ; aucune donnée de démonstration locale n’a été copiée en production.

Le premier essai de promotion a déclenché un retour applicatif après détection
de noms de conteneurs différents de ceux attendus par les contrôles. Les noms
historiques sont désormais explicites dans les trois overlays de production ;
la seconde promotion et tous ses contrôles ont réussi.
