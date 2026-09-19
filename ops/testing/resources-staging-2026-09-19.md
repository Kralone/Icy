# Ressources : validation staging du 19 septembre 2026

## Corrections

- Les réponses raffinage et aperçu admin UEX exposent des tableaux JSON ordinaires, compatibles avec Jackson 3.
- Les prix conservent la date de collecte et la date du relevé séparément. Les relevés sans date ou vieux de plus de 30 jours sont exclus des estimations ; cette règle est affichée.
- Les bonus/malus de raffinage utilisent le dernier relevé daté, sans privilégier artificiellement le rendement maximal. Les valeurs négatives et zéro restent distinctes des absences.
- Le scraper Wiki importe les commodities et leurs distributions dans le catalogue. Les fiches placeholder sans nom sont exclues de la publication.
- Les sites miniers ont une clé stable distincte de leur éventuel identifiant SQL. Concentrations min/max, images catalogue et provenance sont exposées ; occurrence et médiane ne sont pas inventées.
- Les imports manuels vides, mal typés ou incohérents sont refusés avant toute suppression.
- Les équipements affichent leur provenance individuellement ; les images absentes utilisent un placeholder. Les anciennes fiches de vaisseaux peuvent être lues depuis les champs explicites du payload quand les colonnes dérivées sont absentes.

## Vérifications réalisées

- Build backend Java 25 : 247 tests recensés, aucun échec ni erreur, 3 ignorés.
- Build frontend réussi ; avertissements de budgets CSS existants.
- Tests frontend ciblés : 3 réussis (raffinage et navigation entre sites miniers sans identifiant SQL).
- Compatibilité du statut de vol : 6 fixtures PostgreSQL en lecture seule, 6 résultats conformes (anglais objet/chaîne, priorité des valeurs false et absence inconnue).
- Déploiement staging isolé : services sains, HTTP 200, route inconnue 404, API 200.
- Scraping COMMODITIES run 10 réussi : 203 fiches publiées après exclusion des entrées inexploitables.
- API minage : 229 localisations, 229 clés distinctes, 2 513 associations lieu/minerai avec bornes valides. 1 679 associations disposent d'une image catalogue.
- Cache UEX rafraîchi : 205 ressources, 2 595 lignes de prix ; comparaison directe des 25 meilleurs prix affichés avec UEX sans différence au moment du contrôle.
- Raffinage : 9 méthodes, 20 capacités, 215 bonus/malus, 3 audits ; les quatre champs sont de vrais tableaux JSON.
- Équipements sur le backend final : 5 vaisseaux/véhicules (Golem, Prospector, MOLE, ROC, ROC-DS), 20 lasers, 31 modules, 6 gadgets.
- Revue indépendante : corrections des identifiants, classifications, placeholders, validation d'import et statut de vol relues sans blocage restant.

## Limites et suite

- Les sources consultées ne fournissent pas une version de jeu exploitable pour ces lots : l'interface affiche une version inconnue. Une date de collecte ou de traitement source ne prouve pas la validité en jeu.
- Les concentrations sont l'enveloppe min/max des gisements fournis par Wiki, pas une probabilité de présence ni une moyenne de scans joueurs.
- Le run VEHICLES 11 attend 29 choix de variantes dans l'administration avant publication. Ces choix n'ont pas été résolus arbitrairement.
- Vérification visuelle desktop/mobile du staging non effectuée : le compte SSH interdit le transfert TCP. Les tests de composants et les contrôles API ne remplacent pas cette vérification.
- Aucune mise en production effectuée. Les images staging sont des candidates construites depuis l'arbre de travail ; elles ne constituent pas encore une release Git immuable.
- V36 déjà appliquée a été conservée ; l'ajout du scope COMMODITIES est isolé dans V37.

Images candidates staging : `iceforge/backend:staging-resources-release` et `iceforge/frontend:staging-resources-reviewed`.

## Regroupement final

- Historique local et staging : V1�V33, checksum V33 `377288752`.
- Contr�le `verify-flyway-v33.sql` r�ussi sur les deux bases ; backends sains.
- JAR inspect� : une seule V33, aucune V34�V37. Build : 247 tests, z�ro �chec, 3 ignor�s.
- Sauvegarde locale : `.codex-tmp/resources-v33/local-before.dump`.
- Sauvegarde staging et historique pr�c�dent : `/var/backups/iceforge-staging/resources-v33-20260919T160334Z/`.
- Retour arri�re du regroupement staging : restaurer ensemble l�historique sauvegard� et l�ancienne image, backend arr�t�. Un simple retour � l�ancienne image ne suffit pas.
