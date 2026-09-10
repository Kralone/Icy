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
