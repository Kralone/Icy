# Corrections du catalogue

Les administrateurs disposent de deux actions depuis le navigateur du catalogue : Associations des offres et Corriger l’image dans une fiche. Les officiers conservent la lecture du catalogue ; les endpoints de correction exigent ADMIN.

Les propositions d’association comparent uniquement l’identifiant source, le nom normalisé (casse, espaces et ponctuation), ou le préfixe MISC avec son fabricant explicitement vérifié. Aucun suffixe de variante n’est retiré. Une recherche manuelle peut afficher d’autres fiches actives de la catégorie compatible, mais aucune proposition ni recherche n’écrit d’association : l’administrateur choisit une fiche puis valide le couple offre/fiche affiché.

Une association corrigée concerne la ligne d’offre source précise (identifiant UEX, lieu, type d’offre), pas tous les produits de nom voisin. Elle reste visible dans Associations corrigées et peut revenir à l’association source. Les offres inactives restent conservées par les imports ; les corrections reprennent effet si cette même offre redevient active.

Une correction d’image concerne l’identifiant exact de la fiche. L’URL est prévisualisée puis validée ; le serveur accepte HTTPS ou les chemins locaux /images/ et /assets/, sans téléchargement serveur. L’administrateur reste responsable de vérifier qu’il s’agit de la bonne variante. Une correction ne remplace jamais automatiquement une variante manquante par une variante voisine.

## Persistance

Le fragment ops/testing/catalog-overrides-schema.sql est intégré dans la migration unique V32__interface_catalogue_and_publication.sql, après la V31 déployée. Ne pas l’exécuter séparément. Les champs source_image_url/source_image_is_fallback et source_entry_id conservent la dernière valeur importée. Les champs image_override_url et entry_override_id conservent le choix manuel. Les colonnes historiques image_url/image_is_fallback et entry_id restent les valeurs effectives : toutes les lectures publiques, administratives et vues de compatibilité continuent de les utiliser. Les deux mappers appliquent la correction à chaque upsert, sans écraser le choix manuel. Le retour à la source reprend sa dernière valeur, même si elle a changé depuis la correction.

## Validation SQL

CatalogCorrectionsDatabaseTest utilise une base de validation déjà migrée fournie explicitement par CATALOG_TEST_JDBC_URL, CATALOG_TEST_DB_USER et CATALOG_TEST_DB_PASSWORD. Chaque scénario est transactionnel et annulé en fin de test. Utiliser uniquement le clone de validation : les imports testés désactivent temporairement d’autres lignes du jeu de données à l’intérieur de leur transaction. Les tests vérifient la priorité après import, le retour à la dernière source, les variantes des propositions et l’absence de mutation lors de la lecture.

Le script `python ops/testing/test-misc-offer-matching.py` vérifie les deux expressions de matching (valeur effective et valeur source) dans une transaction en lecture seule sur `qol_catalog_verify` par défaut. Il accepte `--docker`, `--container`, `--database` et `--user`, et fonctionne depuis tout répertoire. Les 14 assertions vérifient UUID, nom exact, alias MISC unique, ambiguïté, variante, fabricant et séparation objets/vaisseaux ; le CTE de reprise de V32 est également exécuté en lecture seule.
