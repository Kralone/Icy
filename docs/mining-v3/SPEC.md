# Fiche de minage V3 — spécification

Statut : validé le 16/10/2026, référence du développement. Remplace entièrement les fiches de minage V1 (`mining.*`), qui seront supprimées.

## Objectif

Pendant une session de minage, chacun doit voir en quelques secondes :

- où en est la session ;
- ce qu'il doit faire, lui ;
- combien il va recevoir ou verser, et pourquoi.

Le calcul doit pouvoir se refaire de tête.

## Règle de partage

Une seule formule, qu'il y ait bénéfice ou déficit.

```
Bénéfice net        = total des ventes − total des frais avancés
Valeur d'une part   = bénéfice net / somme des parts
Solde d'un membre   = valeur d'une part × ses parts + frais qu'il a avancés
```

- Chaque participant a **1 part** par défaut. L'organisateur peut la changer : 0,5 (affichée « demi-part »), 0 (exclu du partage), ou une autre valeur. L'interface peut l'afficher en pourcentage d'une part pleine (0,5 = 50 %) : c'est la même donnée.
- Les **frais** couvrent tout ce qui a été payé pour la session : coût des ordres de raffinage, carburant, réparations, matériel, autre. Chaque frais a un payeur, qui en est remboursé.
- Les **minerais conservés** sortent du partage. Leur attribution se règle entre les joueurs, hors du site.
- Un participant à 0 part ne touche rien du bénéfice, mais reste remboursé des frais qu'il a avancés.
- Il faut au moins une part non nulle pour arrêter les comptes.
- Les montants sont des aUEC entiers.

### Arrondis : plus grand reste

Le bénéfice net est réparti en aUEC entiers, sans perte ni création d'argent.

1. Les parts sont converties en centièmes entiers (1 part = 100, 0,5 = 50). Tout le calcul se fait en entiers, sans virgule flottante.
2. Part exacte d'un membre = net × ses centièmes ÷ total des centièmes. On en garde la **partie entière inférieure**, aussi pour un net négatif : −33 333,33 donne −33 334.
3. Écart à combler = net − somme des parties entières. Il vaut au plus « nombre de participants − 1 » aUEC.
4. Cet écart est donné, 1 aUEC chacun, aux membres dont le reste (part exacte − partie entière) est le plus grand. Les membres à 0 part n'en reçoivent jamais.
5. **Départage des égalités :** ordre d'arrivée dans la fiche (date d'ajout du participant), puis identifiant utilisateur.

Le serveur vérifie toujours que **somme des parts = bénéfice net** et que **somme des soldes = total des ventes**.

Exemple : net 100 000 pour 3 parts égales (Alex, Bea, Cid, ajoutés dans cet ordre). Les parties entières font 33 333 chacune, soit 99 999. Il reste 1 aUEC, et les trois restes sont égaux (0,33) : Alex le reçoit. Résultat : 33 334, 33 333 et 33 333.

En déficit, avec un net de −100 000 : les parties entières font −33 334 chacune, soit −100 002. Il reste +2 aUEC, et les restes sont égaux (0,67) : Alex et Bea reçoivent 1 aUEC chacun. Résultat : −33 333, −33 333 et −33 334.

### Exemple : bénéfice, deux vendeurs, une demi-part

| | Parts | Frais avancés | A encaissé |
|---|---:|---:|---:|
| Alex | 1 | 50 000 (raffinage) | 600 000 |
| Bea | 1 | 0 | 400 000 |
| Cid | 0,5 | 100 000 (carburant) | 0 |

Ventes 1 000 000, frais 150 000, net 850 000, 2,5 parts, soit 340 000 par part.

| | Solde | Encaissé | Écart |
|---|---:|---:|---:|
| Alex | 340 000 + 50 000 = 390 000 | 600 000 | doit verser 210 000 |
| Bea | 340 000 | 400 000 | doit verser 60 000 |
| Cid | 170 000 + 100 000 = 270 000 | 0 | doit recevoir 270 000 |

Versements : Alex → Cid 210 000, Bea → Cid 60 000.

### Exemple : session déficitaire

3 participants, 60 000 de ventes encaissées par Bea, 150 000 de frais avancés par Alex. Le net vaut −90 000, soit −30 000 par part.

- Alex : −30 000 + 150 000 = 120 000 à recevoir.
- Bea : −30 000, avec 60 000 encaissés, donc 90 000 à verser.
- Cid : −30 000, donc 30 000 à verser.

Versements : Bea → Alex 90 000, Cid → Alex 30 000. Chacun a perdu 30 000.

### Versements

Écart d'un membre = solde − montant qu'il a encaissé. La somme des écarts vaut toujours 0. Les membres à écart négatif versent à ceux dont l'écart est positif.

L'algorithme est déterministe et réduit le nombre de versements. Le plus gros payeur verse au plus gros receveur le minimum des deux montants, et on recommence jusqu'à ce que tout soit soldé. Les égalités se départagent comme pour les arrondis. Il y a au plus « nombre de participants − 1 » versements.

Le résultat est montré sous forme de liste (« Alex → Cid 210 000 ») et d'un graphique de flux payeurs → receveurs.

## Déroulé de la fiche

La fiche a trois états enregistrés. L'étape affichée en haut de la fiche est déduite des données.

Les étapes peuvent se chevaucher : on vend souvent un premier ordre pendant qu'un autre raffine encore. L'étape affichée est la plus en amont qui n'est pas terminée. Les tâches des étapes suivantes déjà possibles restent listées sous le message principal.

| État | Étape affichée | Ce qui la déclenche | Message principal |
|---|---|---|---|
| `ACTIVE` | Minage | aucun ordre de raffinage | « Ajoutez vos frais et vos ordres de raffinage. » |
| `ACTIVE` | Raffinage | au moins un ordre non prêt | « Dernier raffinage prêt à 22 h 40 (dans 1 h 12). » |
| `ACTIVE` | Remise du cargo | ordres prêts non remis au vendeur | « Marc : 2 ordres à récupérer à CRU-L1, à remettre à Paul. » |
| `ACTIVE` | Vente | cargo remis, minerais restant à vendre | « Reste à vendre : 48 SCU. » + suggestions de vente |
| `SETTLEMENT` | Versements | l'organisateur arrête les comptes | « 2 versements sur 3 confirmés. » |
| `CLOSED` | Terminée | tous les versements reçus, ou clôture forcée | bilan figé |

**Arrêter les comptes** crée un **règlement** : la photographie des parts, des soldes et de la liste des versements à cet instant. Frais, ventes et parts ne sont plus modifiables, ce qui évite qu'une confirmation déjà cochée devienne fausse.

**Clôture.**

- **Clôture normale :** elle a lieu au moment où une confirmation fait passer le règlement à « tous les versements reçus ». C'est l'action de confirmer qui déclenche la clôture, pas le simple fait d'être dans l'état `SETTLEMENT`.
- **Clôture forcée :** l'organisateur clôt alors que des versements ne sont pas confirmés, avec un motif obligatoire. La fiche reste marquée « Clôturée avec N versements non confirmés ».

Le type de clôture est enregistré sur le règlement : `NORMAL` ou `FORCED`.

**Rouvrir pour corriger.** Une fiche n'est jamais fermée définitivement. L'organisateur peut la rouvrir à tout moment, avec un motif court :

- **`CLOSED` → `SETTLEMENT` :** corriger une confirmation, sans toucher aux montants. Le règlement reste le même. La fiche ne se referme pas d'elle-même : elle attend une nouvelle confirmation (qui peut tout reclore) ou une clôture forcée.
- **`SETTLEMENT` ou `CLOSED` → `ACTIVE` :** corriger un frais, une vente ou une part. Le règlement en cours est **annulé, pas effacé** : ses montants et ses confirmations restent consultables dans l'historique. Un nouvel arrêt des comptes crée un nouveau règlement. L'écran prévient avant de valider que les confirmations devront être refaites.

Chaque transition (arrêt, réouverture, clôture normale ou forcée) est tracée dans l'historique : qui, quand, motif. Les participants concernés sont prévenus sur Discord.

**Affichage dans l'état Terminée.** Un versement confirmé s'affiche « Reçu le 23/10 à 00 h 12 », jamais comme une somme encore due. Après une clôture forcée, un versement non confirmé s'affiche « Non confirmé », sans relance. « Ma situation » montre « Soldé » plutôt que « À recevoir » ou « À verser ».

## Contenu de la fiche

### Fiche

- nom, date ;
- organisateur (créateur) ;
- opération liée (facultative, une fiche au plus par opération) ;
- état.

### Participants

- membre et nombre de parts (défaut 1) ;
- vendeur ou non : un participant devient vendeur dès qu'il enregistre une vente ou qu'un ordre lui est destiné.

Le lanceur d'un ordre, le payeur d'un frais et un vendeur sont forcément des participants de la fiche.

### Frais

- type : carburant, réparation, matériel, autre ;
- montant, payeur, note courte facultative ;
- le coût d'un ordre de raffinage est un frais du lanceur de l'ordre ; il n'est pas saisi deux fois.

### Ordres de raffinage

- lanceur : le membre dont le compte détient le cargo raffiné ;
- raffinerie (terminal UEX), méthode (liste UEX), coût ;
- heure de fin : saisie sous forme de durée restante, comme dans le jeu ;
- vendeur destinataire : choisi à la création, modifiable (voir les règles de stock ci-dessous) ;
- état de remise : en raffinage → prêt (calculé à l'heure de fin) → remis au vendeur. « Remis » est la seule action à faire. Quand le lanceur est lui-même le vendeur destinataire, il confirme de la même façon avoir récupéré son minerai (« Je l'ai récupéré ») : rien n'est automatique ;
- lignes de minerai : minerai raffiné (liste UEX), quantité en SCU (deux décimales, stockée en cSCU), **qualité obligatoire**, destination « à vendre » ou « conservé ».

### Ventes

- vendeur, terminal de vente (choisi dans la liste UEX ou parmi les suggestions) ;
- lignes vendues : minerai et quantité. Elles servent à afficher le reste à vendre ;
- **montant réellement encaissé**, saisi par le vendeur. Seul ce montant entre dans le partage.

Un vendeur peut enregistrer autant de ventes que nécessaire, à des endroits différents.

Le site ne calcule jamais le montant d'une vente. Le formulaire peut rappeler l'estimation pour ce terminal, comme repère, mais c'est le montant saisi qui compte. Qualité, offre et demande sont donc reflétées par le prix réel.

### Stock de chaque vendeur

Aucune logistique supplémentaire : le stock se déduit des ordres et des ventes déjà saisis.

```
Stock de V pour un minerai = lignes « à vendre » de ce minerai, dans les ordres remis à V
                           − quantités de ce minerai déjà vendues par V
```

- **Minerais conservés :** ils ne comptent jamais dans un stock.
- **Ventes partielles :** une vente peut prendre une partie du stock. Le reste demeure disponible pour une vente suivante, au même endroit ou ailleurs.
- **Contrôle :** le serveur cumule les quantités par minerai sur toutes les lignes de la vente, puis refuse la vente si un cumul dépasse le stock du vendeur, au cSCU près. Deux lignes de 70 cSCU face à un stock de 100 sont refusées. Le formulaire ne propose que les minerais en stock, avec la quantité disponible.
- **Ordre prêt mais pas encore marqué « remis » :** le formulaire de vente le montre avec un bouton « Je l'ai reçu ». Un clic le marque remis, sans quitter le formulaire.
- **Modifications :** changer le destinataire d'un ordre, ou la quantité d'une ligne, est refusé si cela ferait passer le stock d'un vendeur sous zéro. Il faut d'abord corriger la vente concernée.
- **Reste à vendre de la session** = toutes les lignes « à vendre » − toutes les lignes vendues. Il est affiché par minerai et par vendeur.

### Versements

- payeur, receveur, montant : calculés à l'arrêt des comptes et rattachés à un règlement ;
- confirmation « reçu » cochée par le **receveur**, avec date. Une confirmation peut être retirée tant que la fiche est en `SETTLEMENT`.

## Suggestions de vente

Ce sont des **estimations**, jamais des montants officiels. Pour chaque minerai restant à vendre, la fiche propose les **5 meilleurs points de vente**.

- **Prix :** `price_sell` du jeu UEX `commodities_prices`, du plus élevé au plus bas.
- **Lieu :** via `id_terminal` → `terminals` : système › planète ou lune › station, ville ou avant-poste.
- **Revenu attendu :** prix × quantité restante, plafonné par la demande (`scu_sell_stock`) quand elle est connue. Si elle est inconnue, le plafond n'est pas appliqué et la demande est affichée « non renseignée ».
- **Date du relevé UEX :** affichée. Un prix trop ancien est signalé, pas masqué.
- **Un seul arrêt :** la fiche signale le terminal qui achète le plus de minerais restants à la fois. C'est un repère, pas un itinéraire calculé.

Pas de prix inventé : sans relevé, la ligne indique « aucun prix connu ».

## Droits

L'**organisateur** est le créateur de la fiche, qui doit avoir le rôle SPÉCIALISTE, OFFICIER ou ADMIN. Les OFFICIER et ADMIN ont aussi les droits d'organisateur sur toutes les fiches, pour remplacer un organisateur absent.

| Action | Participant | Organisateur |
|---|:---:|:---:|
| Créer une fiche | | ✓ |
| Ajouter ou modifier **ses** frais, ordres, ventes | ✓ | ✓ |
| Modifier ceux des autres | | ✓ |
| Marquer un ordre « remis » | lanceur et vendeur destinataire | ✓ |
| Gérer participants et parts | | ✓ |
| Arrêter les comptes, rouvrir, forcer la clôture | | ✓ |
| Confirmer « reçu » | receveur | ✓ (au nom du receveur, tracé) |

Tous les membres connectés peuvent consulter les fiches en lecture.

## Lien avec les Opérations

- **Fiches libres :** créées depuis la page des fiches.
- **Fiche liée :** l'éditeur d'opération propose une option « Session de minage ». La fiche est créée quand l'opération est publiée avec cette option, ou dès que l'option est cochée sur une opération déjà publiée.
- **Participants repris une seule fois :** à la création, la fiche reprend tous les membres qui ont répondu « Présent », **affectés à un groupe ou non**, avec 1 part chacun.
- **Ensuite, gestion indépendante :** la fiche ne se resynchronise pas avec l'opération. Un présent de dernière minute s'ajoute depuis la fiche. Un désistement côté opération ne retire personne de la fiche.
- **Une seule fiche par opération :** contrainte d'unicité en base. Si une fiche existe déjà, l'option renvoie vers elle au lieu d'en créer une deuxième. Décocher l'option ne supprime pas la fiche.
- **Lien conservé :** la fiche d'opération affiche un lien vers la fiche de minage et son étape actuelle, et inversement. Si l'opération est supprimée, la fiche reste en place et perd seulement son lien.

## Notifications Discord

Elles passent par RabbitMQ, avec une nouvelle clé de routage `mining.*`, comme les autres annonces. Elles arrivent dans le **salon des notifications**, celui des SC World Events (`DISCORD_NOTIFICATIONS_CHANNEL_ID` côté bot).

- **Ordre prêt :** message avec mention du lanceur : « @Marc, ton raffinage à CRU-L1 est prêt : 32 SCU de Quantanium, à remettre à Paul. »
- **Dernier ordre prêt :** mention de tous les participants qui ont un ordre à récupérer.
- **Comptes arrêtés :** mention de chaque payeur avec ce qu'il doit verser, et à qui.

Le serveur planifie l'envoi à l'heure de fin de chaque ordre. Une modification de l'heure de fin replanifie l'envoi. Une notification déjà envoyée ne repart pas.

## Écran

- **Pensé pour le téléphone ou le second écran pendant la session.** En haut : l'étape, le message principal et l'action qui me concerne.
- **Ajout rapide en un geste :** sur mobile, « + Frais », « + Raffinage » et « + Vente » restent dans une barre fixe en bas de l'écran.
  - La page garde en bas une marge au moins égale à la hauteur de la barre. Un champ ou un bouton qui reçoit le focus défile au-dessus d'elle (`scroll-padding-bottom`).
  - La barre se masque pendant la saisie dans un formulaire, quand le clavier est ouvert, et dans les fenêtres de saisie. Les boutons de validation ne sont jamais recouverts.
- **Suggestions de vente sur mobile :** les 2 meilleurs points de vente par minerai. Le bouton « Voir 3 autres lieux » affiche le reste.
- **Ma situation toujours visible :** « Je reçois 270 000 » ou « Je verse 60 000 à Cid ». Avant la première vente, aucun solde n'est affiché : il ferait apparaître un faux déficit. L'encart montre seulement les frais que j'ai avancés et qui me seront remboursés.
- **Bloc Raffinage :** une carte par ordre (lanceur, raffinerie, compte à rebours, minerais en pastilles colorées, destinataire, état de remise).
- **Bloc Vente :** reste à vendre par minerai, suggestions, ventes enregistrées.
- **Bloc Partage :**
  - les trois totaux (ventes, frais, net), la valeur d'une part ;
  - une ligne par participant, détail du calcul dépliable ;
  - les versements et le graphique de flux. Dans l'état Terminée, ce sont des versements reçus, pas des dettes.
- **Mise à jour en direct** par WebSocket.
- Couleurs d'état cohérentes : à faire, en cours, prêt, confirmé.

Une maquette accompagne ce document.

## Modèle de données (proposition)

Schéma PostgreSQL `session` pour la couche commune, `mining` pour la couche propre au minage. Montants en `BIGINT` (aUEC), quantités en `INTEGER` (cSCU).

| Table | Colonnes principales |
|---|---|
| `session.sheets` | id, activity (`MINING`), name, session_date, organizer_user_id, operation_event_id (unique, nullable, `ON DELETE SET NULL`), status (`ACTIVE`, `SETTLEMENT`, `CLOSED`), revision, created_at, updated_at |
| `session.participants` | sheet_id, user_id, shares_centi `INTEGER` ≥ 0 (100 = 1 part), joined_at — unique (sheet_id, user_id) |
| `session.expenses` | id, sheet_id, payer_user_id, kind (`FUEL`, `REPAIR`, `MATERIAL`, `OTHER`), amount > 0, note |
| `session.sales` | id, sheet_id, seller_user_id, terminal_id (UEX), terminal_label, amount > 0, sold_at |
| `session.settlements` | id, sheet_id, created_at, created_by, total_sales, total_expenses, net, cancelled_at, cancelled_by, closed_at, close_kind (`NORMAL`, `FORCED`), close_reason |
| `session.settlement_shares` | settlement_id, user_id, shares_centi, share, advanced, cashed, balance — photographie des soldes |
| `session.settlement_transfers` | id, settlement_id, from_user_id, to_user_id, amount > 0, received_at, received_by_user_id |
| `session.history` | id, sheet_id, actor_user_id, action (`SETTLED`, `REOPENED_SETTLEMENT`, `REOPENED_ACTIVE`, `CLOSED`, `FORCED_CLOSE`, `RECEIPT_CONFIRMED`, `RECEIPT_WITHDRAWN`), reason, at |
| `mining.refinery_orders` | id, sheet_id, launcher_user_id, terminal_id (UEX), method_code (UEX), cost ≥ 0, finishes_at, recipient_user_id, handed_over_at, ready_notified_at |
| `mining.refinery_order_lines` | order_id, commodity_id (UEX), quantity_cscu > 0, quality 0–1000, destination (`SELL`, `KEEP`) |
| `mining.sale_lines` | sale_id, commodity_id, quantity_cscu > 0 |

- « Prêt » n'est pas stocké : il se déduit de `finishes_at`. « Remis » correspond uniquement à `handed_over_at` renseigné, y compris quand le lanceur est le destinataire.
- Le coût d'un ordre est lu depuis `refinery_orders` dans le calcul des frais, sans ligne dupliquée dans `expenses`.
- Un seul règlement non annulé par fiche, garanti par un index unique partiel sur `cancelled_at IS NULL`. Un règlement annulé garde ses montants et ses confirmations.
- Les contrôles de stock et d'arrondi sont faits côté serveur, dans la transaction qui écrit la vente ou l'ordre.
- `revision` protège contre deux modifications simultanées, comme pour les opérations.

## API (proposition)

Préfixe `/api/sessions`. Chaque écriture renvoie la fiche complète et diffuse un événement WebSocket.

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/` · `/{id}` | liste (actives puis historique) · fiche complète avec calcul |
| POST | `/` | créer une fiche libre |
| PUT | `/{id}/participants` | participants et parts |
| POST · PUT · DELETE | `/{id}/expenses[/{expenseId}]` | frais |
| POST · PUT · DELETE | `/{id}/refinery-orders[/{orderId}]` | ordres et lignes de minerai |
| POST · DELETE | `/{id}/refinery-orders/{orderId}/handover` | marquer remis · annuler (refusé si le stock du vendeur passerait sous zéro) |
| POST · PUT · DELETE | `/{id}/sales[/{saleId}]` | ventes (contrôle du stock du vendeur) |
| GET | `/{id}/stock` | stock par vendeur et par minerai, reste à vendre |
| GET | `/{id}/sale-suggestions` | 5 meilleurs points de vente par minerai restant |
| POST | `/{id}/settle` · `/{id}/reopen` · `/{id}/close` | arrêter les comptes · rouvrir (cible et motif) · forcer la clôture (motif) |
| POST · DELETE | `/{id}/transfers/{transferId}/received` | confirmer · retirer une confirmation |
| GET | `/{id}/history` | transitions et règlements annulés |

Le calcul du partage est fait par le serveur et testé à part avec les exemples de ce document : bénéfice, déficit, demi-part, part à 0, plusieurs vendeurs, arrondis, égalités. Cas de clôture à couvrir aussi : réouverture `CLOSED` → `SETTLEMENT` sans reclôture immédiate, clôture forcée, et règlement annulé conservé.

## Suppression de la V1

- **Migration destructive.** La V3 part en production en une seule livraison, avec une **nouvelle** migration Flyway unique (prochain numéro, aujourd'hui `V45`). Elle supprime les tables V1 du schéma `mining` et crée le nouveau modèle.
- **Migrations existantes intouchées.** Aucune migration historique n'est modifiée, en particulier `V27` et `V31`.
- **Code retiré :** l'API `/api/mining-sheets`, les écrans `features/utils/mining-sheets`, la logistique non branchée et les tests associés.
- **Avant toute mise en production :** sauvegarde fraîche, puis restauration vérifiée sur un environnement isolé, selon [PRODUCTION-BACKUPS.md](../PRODUCTION-BACKUPS.md). Les données V1 ne sont pas reprises.
- **Contraintes inchangées :** droits vérifiés côté serveur pour chaque action, isolation des environnements (local, staging, production), secrets hors du code. Le canal Discord de test est utilisé tant que la production n'est pas visée.

## Ouverture vers le salvage

Participants, parts, frais, ventes et versements ne dépendent pas du minage. Seuls les ordres de raffinage et les suggestions de minerais sont propres au minage. Le modèle sépare ces deux couches, pour qu'une fiche de salvage puisse réutiliser la première.

## Hors périmètre

- Attribution des minerais conservés.
- Temps de présence.
- Usure des vaisseaux, sauf frais déclarés.
- Vérification des paiements en jeu : le site enregistre seulement des déclarations.

## Décisions prises

- Notifications : salon des notifications, partagé avec les SC World Events.
- Prix : le site estime, le vendeur saisit le montant réel. La qualité reste notée mais n'entre dans aucun calcul.
- Clôture : immédiate, sans délai de grâce. Une fiche peut toujours être rouverte par l'organisateur.
- Arrondis : plus grand reste en entiers, départage par ordre d'arrivée dans la fiche.
- Stock : on ne vend que ce qu'on a reçu. Une seule action de remise (« Remis », ou « Je l'ai récupéré » pour son propre ordre), faisable depuis le formulaire de vente. Les quantités sont cumulées par minerai avant le contrôle.
- Opérations : reprise unique des présents (affectés ou non), puis gestion indépendante, une seule fiche par opération.

## Découpage proposé

Les lots sont développés et vérifiés l'un après l'autre en local, puis livrés ensemble.

1. Modèle, calcul du partage et des versements, API et tests du calcul (exemples ci-dessus).
2. Écran de la fiche : étapes, frais, ordres, ventes, partage. Suppression de la V1.
3. Suggestions de vente (prix et lieux UEX).
4. Remise du cargo et confirmations des versements.
5. Lien avec les Opérations et notifications Discord.
