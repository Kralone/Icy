# Fiche de minage V3 : dossier de relecture

## Contexte

IceForge est la plateforme d'une organisation francophone de joueurs de **Star Citizen**. Elle comprend un site Angular 22, une API Spring Boot 4 (Java 25), PostgreSQL 18 et un bot Discord en Python relié par RabbitMQ. Les membres y préparent des opérations, gèrent leur flotte et suivent leurs activités en jeu.

Dans Star Citizen, le **minage en groupe** se déroule en plusieurs temps :

1. Plusieurs joueurs minent ensemble, souvent à bord des mêmes vaisseaux.
2. Le minerai brut est déposé dans une **raffinerie**, en station. Chaque dépôt est un « ordre de raffinage », qui a :
   - une méthode, un coût et une durée, parfois plusieurs heures ;
   - un propriétaire : le minerai raffiné reste sur le compte du joueur qui a lancé l'ordre.
3. Une fois raffiné, le minerai est récupéré, regroupé chez un ou plusieurs vendeurs, puis vendu à des terminaux. Les prix varient selon le lieu, l'offre et la demande.
4. Pendant la session, certains joueurs avancent de l'argent : carburant, réparations, coût du raffinage. L'argent des ventes arrive chez les vendeurs uniquement.

À la fin, il faut savoir **qui doit combien à qui**. Le jeu ne fait rien de tout ça : les joueurs se l'organisent au vocal, sur des tableurs ou de mémoire.

## À quoi sert la fiche de minage

C'est la feuille de compte partagée d'une session de minage, ouverte sur un téléphone ou un second écran pendant que l'on joue. Elle sert à :

- **suivre la session** : qui a lancé quel raffinage, où, et quand il sera prêt ; qui doit apporter quel cargo à quel vendeur ; ce qui reste à vendre ;
- **aider à vendre** : les meilleurs points de vente par minerai, avec le lieu et un revenu estimé (données UEX) ;
- **partager équitablement** : chaque frais avancé est remboursé à celui qui l'a payé, puis le bénéfice est divisé à parts égales ;
- **solder les comptes** : la liste minimale des versements entre joueurs, confirmés un par un par ceux qui reçoivent ;
- **prévenir sur Discord** : « ton raffinage est prêt », « tu dois verser X à Y ».

## But de la refonte

La V1 existe, mais elle est jugée illisible : chiffres et textes partout, impossible de savoir où en est la session ni qui doit agir. Sa règle de partage mélange deux logiques, et les fiches ne se terminent jamais. Voir [ANALYSE-V1.md](ANALYSE-V1.md).

La V3 repart de zéro, avec trois exigences :

1. **Une règle que tout le monde peut refaire de tête :**
   `solde = (ventes − frais) ÷ parts × mes parts + mes frais avancés`.
2. **Une étape et une action à la fois :** chaque joueur voit tout de suite ce qui se passe et ce qu'il a à faire.
3. **Une fin nette :** comptes arrêtés, versements confirmés, fiche terminée. Elle reste rouvrable pour corriger une erreur.

Cible : les sessions de minage de l'organisation, de 2 à une dizaine de joueurs. Le modèle doit pouvoir s'étendre plus tard au salvage, la récupération d'épaves.

## Contenu du dossier

| Fichier | Contenu |
|---|---|
| [SPEC.md](SPEC.md) | Spécification complète : règle de partage avec exemples chiffrés, déroulé et états, contenu de la fiche, suggestions de vente, droits, lien avec les Opérations, notifications Discord, écran, modèle de données, API, suppression de la V1, découpage en lots. |
| [ANALYSE-V1.md](ANALYSE-V1.md) | Fonctionnement et défauts de la V1 actuelle. |
| [maquette-fiche.html](maquette-fiche.html) | Maquette interactive, à ouvrir dans un navigateur. En haut, on choisit l'étape et le participant (« Vu par »). Les montants sont recalculés avec la vraie formule. |
| [calcul.test.mjs](calcul.test.mjs) | Vérifications du calcul (partage, arrondis, versements, stock des vendeurs) sur le code même de la maquette. Lancer `node docs/mining-v3/calcul.test.mjs`. |
| `captures/` | Captures pleine page de la maquette, listées ci-dessous. |

La maquette reprend le style visuel des fiches d'opération déjà en production : bannière photo, barre de sections collante, panneaux à liseré coloré, encart personnel cyan. Les données et les prix sont des exemples.

### Captures

| Capture | Étape | Vu par | Largeur |
|---|---|---|---|
| `01-minage-bureau.png` | Minage : frais seulement, aucun ordre | Torin | 1 440 px |
| `02-raffinage-bureau.png` | Raffinage : un ordre prêt, deux en cours | Vexa | 1 440 px |
| `03-remise-cargo-bureau.png` | Remise du cargo, première vente possible | Torin | 1 440 px |
| `04-vente-bureau.png` | Vente : une vente enregistrée, suggestions et formulaire | Vexa | 1 440 px |
| `05-versements-bureau.png` | Comptes arrêtés, 1 versement confirmé sur 3 | Torin | 1 440 px |
| `06-terminee-bureau.png` | Terminée, clôture normale | Kralone | 1 440 px |
| `11-cloture-forcee-bureau.png` | Terminée, clôture forcée avec un versement non confirmé | Mira | 1 440 px |
| `07-vente-mobile.png` | Vente | Vexa | 390 px |
| `08-versements-mobile.png` | Versements | Torin | 390 px |
| `09-versements-4k.png` | Versements | Kralone | 3 840 px |
| `10-mobile-premier-ecran.png` | Raffinage, premier écran avec la barre d'actions | Torin | 390 px |

Sur les captures mobiles pleine page, la barre d'actions fixe du bas est masquée, sinon elle apparaîtrait au milieu de l'image. La capture 10 la montre en situation.

## Décisions déjà prises avec le porteur du projet

- Parts égales pour tous les présents. Pas de temps de présence. L'organisateur peut mettre une demi-part ou exclure (0 part).
- Les frais avancés sont remboursés avant le partage. En cas de déficit, la même formule répartit la perte à parts égales.
- Pas d'usure de vaisseau, sauf réparations déclarées en frais.
- Les minerais conservés (souvent de haute qualité) sortent du partage. Leur attribution se règle entre joueurs, hors du site.
- Qualité notée obligatoirement, mais hors calcul : le vendeur saisit le montant réellement reçu, le site ne fait qu'estimer.
- Un ordre de raffinage par lancement, avec méthode, coût et heure de fin. Il désigne un vendeur destinataire.
- Plusieurs vendeurs possibles, ventes par petits paquets à plusieurs endroits.
- Le receveur confirme « reçu ». La fiche se termine sans délai, et l'organisateur peut toujours la rouvrir.
- Les organisateurs ont le rôle SPÉCIALISTE, OFFICIER ou ADMIN.
- Fiches libres possibles. Une opération déclarée « session de minage » crée sa fiche liée.
- Notifications dans le salon Discord des notifications, avec mention des personnes concernées.
- Les fiches V1 sont supprimées, sans reprise de données, par une nouvelle migration destructive précédée d'une sauvegarde et d'une restauration vérifiées.

## Suite à la première relecture

- **Arrondis :** plus grand reste en entiers, départage par ordre d'arrivée. La maquette applique désormais exactement cette méthode, couverte par les tests.
- **Stock par vendeur :** on ne vend que ce qui a été remis. Les minerais conservés sont exclus, les ventes partielles sont gérées, et il n'y a qu'une seule action de remise.
- **Clôture :**
  - un règlement par arrêt des comptes, conservé quand il est annulé ;
  - clôture normale ou forcée, enregistrée ;
  - pas de reclôture automatique après une réouverture ;
  - dans l'état Terminée, les versements sont affichés comme reçus.
- **Opérations :** reprise unique des présents, affectés ou non, puis gestion indépendante. Une seule fiche par opération.
- **Mobile :** 2 meilleurs lieux par minerai, les autres sur demande. Barre d'actions masquée pendant la saisie.

## Ce qu'on attend de la relecture

1. **La règle de partage :** est-elle juste et sans cas limite oublié ? Par exemple : déficit, participant à 0 part qui a avancé des frais, vendeur qui n'a avancé aucun frais, arrondis, vente enregistrée après l'arrêt des comptes.
2. **Le déroulé et les états :** l'arrêt des comptes, la réouverture et la clôture automatique sont-ils cohérents ? Une situation peut-elle bloquer une fiche ?
3. **La lisibilité :** un joueur qui découvre la fiche en pleine session comprend-il où on en est et ce qu'il doit faire ? Les captures montrent-elles trop ou pas assez d'informations ?
4. **Le modèle de données et l'API :** manque-t-il quelque chose pour la remise du cargo, les ventes partielles, l'historique ou l'extension au salvage ?
5. **Le mobile :** la saisie rapide est-elle réaliste pendant le jeu ?
6. Tout ce qui paraît flou, contradictoire ou superflu.
