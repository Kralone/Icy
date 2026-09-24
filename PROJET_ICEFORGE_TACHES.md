# IceForge — feuille de route complète

## Contexte

IceForge est une application Angular/Spring dédiée à Star Citizen : catalogue, Wikelo, vaisseaux, ressources minières, fiches de minage, événements, flotte, hangars, objectifs, actualités CIG Watch et administration.

Le développement courant se fait en local sur Docker. La prévisualisation visible est `http://127.0.0.1:18088`. Ne rien publier en production sans demande explicite. L'utilisateur souhaite regrouper les changements avant staging puis production.

## Règles produit

- Interface en français, textes courts et factuels.
- Utiliser les images, couleurs, logos et modèles du catalogue.
- Ne jamais présenter une donnée absente comme réelle.
- Ne pas déduire une grille cargo à partir de la capacité SCU.
- Responsive mobile, grand écran et 4K.
- Les actions, statuts, montants et remboursements doivent être lisibles.
- Une seule migration Flyway pour un lot donné, si une migration est nécessaire.
- Tester localement et visuellement avant toute promotion.

## État technique local

- Frontend : `icy-angular`
- Backend : `icy_backend`
- Stack Docker : projet `iceforge_dev`
- Front visible : port `18088`
- Backend visible : port `18080`
- Base locale Docker : port `15432`
- Le compte de test utilisé dans l'interface locale est `validation_admin`.
- Le frontend a été reconstruit avec Node/pnpm du runtime Codex quand les binaires système ne sont pas dans le PATH.

## Travail déjà réalisé

### Hangar exécutif / PYAM

- Ajout de visuels locaux pour Hornet F7A Mk II, Meteor et Syulen.
- Résolution d'images PYAM par correspondance avec le catalogue.
- Affichage fabricant, capacité et rôle.
- Affichage honnête `Équipement catalogue non renseigné` quand aucune relation d'équipement n'existe.

### Flotte

- Regroupement des vaisseaux identiques avec quantité.
- Logo constructeur affiché.
- Cartes rendues cliquables.
- Modal partagé de détail ajouté.
- Vérification locale : le clic sur un Prospector ouvre le modal avec image, équipage et soute.
- Vérifier et supprimer toute ancienne occurrence de texte littéral `` `n`n ``.

### Ressources

- Endpoint backend `/api/front/resources/catalog` ajouté pour consulter le catalogue unifié.
- Onglet `Vaisseaux, Modules, Outils` branché sur les familles `SHIP` et `SHIP_COMPONENT`.
- Fallback frontend vers les données catalogue lorsque les listes spécialisées sont vides.
- Vérification locale effectuée : Golem, Prospector, MOLE, ROC et ROC-DS sont visibles.
- À terminer : appliquer le même flux catalogue proprement à chaque onglet (prix, raffinage, planètes/minerais) et harmoniser les noms français.

### Fiches de minage

- Historique replié par défaut.
- Pagination de l'historique limitée à cinq fiches.
- Correction d'une erreur Angular de balise fermante.
- À poursuivre : refonte complète création/suivi/vente/finalisation.

## Chantiers prioritaires

### 1. Fiches de minage V2

Objectif : supprimer la confusion actuelle et rendre le calcul compréhensible.

- Repenser le parcours : création → déclarations → raffinage → vente → verrouillage → finalisation.
- Verrouillage obligatoire avant finalisation.
- Boutons successifs, visuellement distincts, avec hover, état disabled et explication.
- Une vente peut agréger plusieurs fiches ouvertes.
- Les minerais déclarés doivent être présentés en lignes/cartes colorées, lisibles et regroupées par minerai.
- Supprimer ou reformuler le suivi détaillé s'il duplique la vue globale.
- Afficher clairement valeur brute, frais avancés, montant net et bénéficiaires.
- Les frais avancés sont remboursés aux personnes qui les ont payés avant la répartition finale.
- Afficher les transferts à effectuer par participant.
- Garder l'historique pliable, fermé par défaut, cinq éléments par page.
- Ajouter des états vides, erreurs et confirmations utiles.
- Ne pas fermer implicitement une fiche lors d'une simple déclaration de vente sans vérifier le workflow métier.

### 2. Wikelo V2

Objectif : repartir de la V1 avec une interface claire et exhaustive.

- Séparer les catégories : vaisseaux, armes, armures et autres objets.
- Afficher une fiche par élément avec image, fabricant, rôle/type, statistiques et conditions d'échange.
- Afficher les ingrédients et quantités sous forme de grille/cartes, adaptée à de longues listes.
- Récupérer via le scrap les listes nécessaires à la création des armes et armures.
- Identifier pourquoi Idris P et d'autres recettes ont des valeurs erronées.
- Corriger les fiches sans image avec une stratégie de fallback contrôlée.
- Replier la carte en recliquant dessus ou en cliquant dans le vide.
- Animation de dépliage fluide et scroll automatique vers la carte ouverte.
- Bouton réduire en icône en haut à droite.
- Supprimer étoiles et bouton Source inutiles.
- Réserver `Créer un objectif` aux administrateurs.
- Supprimer les textes décoratifs et labels répétitifs.
- Relier les vaisseaux Wikelo au catalogue pour compléter rôle, soute et fabricant quand la correspondance est certaine.

### 3. Catalogue et offres vaisseaux

- Harmoniser l'UI du catalogue avec le reste de l'application.
- Filtres stylisés : constructeur, gameplay (combat, fret, minage, médical, exploration, course, transport, soutien, polyvalent), achat/location.
- Retirer le tag redondant `Achat` dans les fiches.
- Afficher planète → lieu pour les points de vente.
- Une planète peut contenir plusieurs lieux, stations ou villes.
- Corriger le scrap qui ne remonte actuellement pas correctement stations, lieux et villes.
- Corriger les visuels manquants d'Origin, ArCorp, MicroTech et autres constructeurs.
- Éviter la déformation des images dans les cartes et modals : conserver le ratio avec `object-fit: cover` ou `contain` selon le contexte.
- Mettre fabricant et rôle en avant ; afficher le logo constructeur lorsque le catalogue en possède un.
- Enrichir les statistiques sans inventer les valeurs absentes.
- Ne pas afficher `Non renseignée` si une valeur fiable peut être récupérée du catalogue ; sinon garder une valeur explicitement absente.

### 4. Flotte et hangars

- Utiliser le même composant modal dans flotte et hangar personnel.
- Dans la flotte, afficher au survol les propriétaires d'un modèle.
- Mettre davantage en avant le logo de marque.
- Conserver les cartes compactes et supprimer le mot `exemplaires`.
- Dans le hangar exécutif PYAM, afficher composants et armes plutôt qu'un long descriptif quand ces données sont disponibles.
- Étudier la liste officielle PYAM et les modèles Wikelo manquants.
- Ne jamais déduire une grille cargo à partir du seul SCU.

### 5. Calendrier et événements

- Refaire visuellement le calendrier : plus coloré, plus large, plus visuel, sans surcharge.
- Mettre les dates en avant avec une séparation nette des cartes.
- Utiliser images, couleurs de fond et couleur de texte configurées dans les modèles d'événement.
- Prévoir une prévisualisation d'événement à droite du formulaire d'ajout, avec le même rendu que la fiche publique.
- Pagination des types d'événement.
- Lors de la reprogrammation, supprimer la seconde alerte redondante sur les dates.
- Retirer slogans et compteurs inutiles (`programme de l'équipage`, `quatre rendez-vous`, etc.).
- Masquer les événements SC World Event lorsqu'il n'y en a aucun, dans la barre latérale et l'accueil.
- Corriger l'affichage mobile du menu public.

### 6. CIG Watch, actualités et bot Discord

- Réparer le pipeline CIG Watch.
- Ne publier que les vraies actualités importantes ; ignorer les messages mineurs de développeurs sur Spectrum/Reddit.
- Dédupliquer et filtrer les sources.
- Traduire gratuitement sans OpenAI, par exemple via LibreTranslate local déjà présent dans la stack, avec fallback en cas d'échec.
- Enregistrer le texte traduit en base avant publication.
- Publier les actualités validées dans le canal Discord configuré.
- Vérifier bot token, permissions `Voir le salon`, `Envoyer des messages` et ID du canal.
- Ajouter une image d'actualité fiable ou un fallback visuel lorsqu'elle manque.
- Tester en local avec un canal de test avant toute mise en production.

### 7. Objectifs

- Refaire l'écran principal et l'administration.
- Présenter les objectifs comme des objectifs globaux, pas comme des missions.
- Réduire les textes redondants et clarifier progression, responsables, statut et échéance.
- Réserver les actions d'administration aux comptes autorisés.

### 8. Administration et ancienne base

- Remplacer les anciennes sections galaxie (vaisseau, item, planète, lune, station) par des entrées du catalogue interne lorsque celui-ci couvre la donnée.
- Retirer le mot `section` des intitulés d'images.
- Retirer les collections et menus obsolètes si aucune fonctionnalité active ne les utilise.
- Conserver la gestion de la bibliothèque d'images.
- Auditer les écrans admin cassés et les liens vers l'ancien scrap.
- Remplacer les textes vides ou décoratifs par des libellés factuels.

## Données et scrap

- Auditer les tables et DTO des offres, planètes, lieux, stations, villes, recettes Wikelo, armes, armures, images et logos.
- Comparer les données scrapées avec les entrées catalogue.
- Tracer l'origine d'une donnée et sa date de synchronisation.
- Ne pas écraser une donnée manuelle fiable avec une valeur vide du scrap.
- Ajouter des rapports d'anomalies : recette absente, image absente, lieu absent, soute non renseignée, modèle non rapproché.
- Le scrap doit être idempotent et relançable sans doublons.

## Vérification locale obligatoire

1. Reconstruire le frontend avec le runtime Node/pnpm disponible.
2. Vérifier que la compilation Angular ne signale aucune erreur de template.
3. Recréer uniquement le conteneur frontend si nécessaire.
4. Ouvrir les pages modifiées sur `127.0.0.1:18088`.
5. Tester les états chargement, vide, erreur et données.
6. Tester au moins un écran mobile et un écran 4K.
7. Vérifier les clics de cartes, modals, pagination et boutons successifs.
8. Exécuter `git diff --check`.
9. Regrouper les changements et n'ajouter qu'une migration Flyway pour le lot si nécessaire.
10. Ne pas passer en staging ou production sans demande explicite ultérieure.

## Commandes locales utiles

```powershell
$node = "C:\Users\floga.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$pnpm = "C:\Users\floga.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
cd "C:\Users\floga\IdeaProjects\IceForge\icy-angular"
& $pnpm install --force --shamefully-hoist
& $node "node_modules\@angular\cli\bin\ng.js" serve --host 0.0.0.0 --port 4200
```

Pour Docker, utiliser le binaire Docker Desktop si `docker` n'est pas dans le PATH et reconstruire le service frontend après modification.

## Critères d'acceptation du prochain lot

- Les changements demandés sont visibles sur le site local après rechargement avec cache busting.
- Le frontend compile sans erreur Angular.
- Les données absentes restent explicitement absentes.
- Les fiches de minage expliquent le calcul et remboursent les frais avancés avant partage.
- Wikelo sépare vaisseaux, armes et armures et affiche les recettes disponibles.
- Les offres utilisent planète → lieu et affichent stations/lieux réellement présents dans les données.
- Le calendrier et les cartes événement utilisent les modèles visuels.
- CIG Watch filtre, traduit et publie uniquement les vraies actualités dans le canal de test.
- Aucun changement n'est envoyé en production dans ce lot.

## Lot prioritaire à transférer — demandes récentes

Ces éléments sont prioritaires ; le reste peut attendre.

### Historique des fiches de minage

- Historique repliable et replié par défaut.
- Pagination dans l'historique, avec cinq fiches maximum par page.

### Modal partagé flotte / hangar

- Utiliser exactement le même composant modal pour le hangar personnel et la flotte.
- Afficher les détails du vaisseau dans ce modal.
- Dans la flotte, au survol d'une carte, afficher les membres qui possèdent le vaisseau.
- Revoir légèrement le design des pages récemment refondues pour harmoniser le rendu.

### Ressources reliées au catalogue

- Relier les données de chaque onglet de Ressources au catalogue interne : prix de vente, raffinage, planètes et minerais, vaisseaux/modules/outils.
- Éviter les listes statiques ou déconnectées du catalogue.
- Conserver les valeurs explicitement absentes lorsqu'aucune donnée catalogue fiable n'existe.
- Vérifier le résultat dans chaque onglet sur l'environnement local.

### Hangar exécutif PYAM

- Dans les fiches PYAM, privilégier les composants et armes équipés au long descriptif du vaisseau.
- Diagnostiquer les images manquantes et utiliser les visuels officiels ou les correspondances catalogue validées.
- Comparer la liste actuelle à la liste officielle afin d'identifier les vaisseaux PYAM manquants.
- Inclure les modèles Wikelo lorsqu'ils correspondent à un vaisseau officiel.
- Ne pas inventer de composants, d'armes, d'images ou de statistiques absents des sources.

### Vérification obligatoire de ce lot

- Rebuild frontend après chaque série de modifications.
- Ouvrir les quatre onglets Ressources, la flotte et le hangar exécutif sur `http://127.0.0.1:18088`.
- Vérifier visuellement le modal partagé, le hover propriétaire, l'historique fermé et sa pagination.
- Vérifier les images PYAM et l'affichage des composants/armes.
- Ne pas passer en staging ou production pour ce lot.
