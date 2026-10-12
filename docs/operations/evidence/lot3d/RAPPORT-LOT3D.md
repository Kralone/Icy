# Lot 3D — fiche participant et finition (2026-10-12)

Branche `feat/operations-lot3-organisation`. Rien n'est poussé. Plan validé : bannière et structure (3D-1), organisation et affectations (3D-2), flotte et aperçu (3D-3), finition (3D-4).

## 3D-1 — Structure et identité visuelle

### Ce qui est livré

- **Bannière** : image de mission, à défaut image du type d'événement, à défaut aplat aux couleurs du type. Type, statut (À venir, En cours, Terminée), titre, date, horaires de début et de fin, rendez-vous, nombre de confirmés. Le statut vient du serveur, pas de l'horloge du navigateur.
- **Barre de sections** collée en haut de la zone de lecture : Présence, Briefing, Organisation, Flotte, et Coordination pour qui a des groupes à coordonner. Ce sont des ancres : tout reste visible au défilement.
- **Fiche pleine largeur** (plafonnée à 1600 px), panneaux distingués par une couleur et un pictogramme.
- **Briefing et objectifs** côte à côte ; objectifs principaux puis secondaires ; un long briefing se replie sur mobile.
- **Présence** : le panneau partagé avec la modale du calendrier est réutilisé sans modification.
- Le bandeau « Situation » et son compteur en double sont supprimés ; le nombre de confirmés est dans la bannière.
- Serveur : la réponse de l'opération porte le nom, les couleurs et l'image du type d'événement, et indique si l'heure de début est atteinte.

Organisation, coordination et flotte gardent leur contenu actuel dans la nouvelle structure ; elles sont retravaillées en 3D-2 et 3D-3. « Mon affectation » arrive en 3D-2.

### Tests exécutés

| Suite | Résultat |
|---|---|
| Backend, build Docker | 341 tests, 0 échec, 3 ignorés |
| Front, 4 specs ciblées | 22 tests passés (bannière 3, fiche 4, éditeur 12, panneau de présence 3) |

Suite front complète non lancée.

### Vérifications à l'écran sur la pile dev

| Vérification | Résultat observé |
|---|---|
| Largeur de la fiche à 1440 px | 1110 px sur 1142 px disponibles, sans défilement horizontal |
| Image de la bannière sans image de mission | Image du type d'événement, chargée depuis le site |
| Opération avec image de mission | Image de mission affichée |
| Barre de sections | Reste collée sous l'en-tête ; un clic amène le panneau juste dessous |
| Présence | Mêmes trois boutons et trois colonnes ; réponse active relue sur le serveur |
| Opération terminée | Statut « Terminée », boutons de présence désactivés |
| Mobile 375 px | Aucun débordement ; boutons de section de 40 px, barre défilable |
| Événement classique depuis le calendrier | Modale historique, trois boutons, trois colonnes |
| Opération depuis le calendrier | Fiche dédiée, pas de modale |

Non vérifié : tablette et écran 4K (prévus en 3D-4) ; bannière sans aucune image, couverte par la spec seulement ; défilement animé, non observable dans le navigateur de test.

### Revue indépendante

Aucun bloquant, 5 constats importants, 12 mineurs. Les 5 importants sont corrigés :
1. Le bouton « Briefing » ne déplaçait pas le focus clavier.
2. Le statut « En cours » dépendait de l'horloge et du fuseau du navigateur : il vient maintenant du serveur.
3. Le nombre de confirmés disparaissait le temps de chaque relecture.
4. Une image en échec sur une opération faisait sauter l'image de la suivante.
5. Le lien « Calendrier » et le titre manquaient de fond sur une image claire.

Mineurs corrigés : vocabulaire aligné sur « confirmés » ; états vides au futur sur une opération terminée ; briefing fait d'espaces qui masquait la description ; libellé de la section Présence ; coordination sans ancre ; bannière, barre et panneaux alignés sur la même marge ; bord estompé de la barre sur mobile ; couleurs de type appliquées seulement en paire valide ; image sans référent.

Laissés ouverts :
- Le statut de la bannière est celui du chargement de la page : il ne change pas tout seul au passage de l'heure.
- « 8 confirmés » dans la bannière répète le compteur de la colonne « Confirmés ».
- L'entrée d'aperçu et le statut « Brouillon » de la bannière ne servent qu'à partir du 3D-3.
- Contraste sur une image très claire : renforcé, non vérifié sur une image réelle de ce type.

### Captures

`3d1-desktop-banniere-presence.jpg`, `3d1-desktop-briefing-objectifs.jpg`, `3d1-desktop-operation-terminee.jpg`, `3d1-mobile-banniere-presence.jpg`, `3d1-mobile-briefing.jpg`.

Les deux captures mobiles datent d'avant les corrections de la revue (« 8 présents » y est devenu « 8 confirmés », le lien Calendrier a maintenant un fond).

## 3D-2 — Organisation et affectations

### Ce qui est livré

- **Mon affectation** : groupe, groupe parent, responsable, mode, statut, demande en attente. Actions : choisir ou changer de groupe, annuler sa demande, quitter son groupe. Le bloc est à droite de la présence sur grand écran et en tête de fiche sur mobile.
- **Organigramme** : une carte par groupe principal, sous-groupes rattachés par un trait. Chaque groupe montre effectif, capacité avec jauge, mode, responsable, description et membres ; mon nom est marqué « Vous », mon groupe « Votre groupe ».
- **Action par groupe**, selon ce que la destination permet : Rejoindre ou Passer dans ce groupe (libre), Demander à rejoindre ou Demander le transfert (sur validation), Complet, géré par l'organisateur, Demande envoyée.
- **Lisibilité** : au-delà de 8 membres, un groupe affiche « + N autres » ; les groupes principaux se replient. Sur mobile, seul mon groupe est ouvert à l'arrivée.
- **Serveur** : lecture de la composition pour tout membre (`GET …/composition`), quitter son groupe (`DELETE …/assignments/me`), annuler sa demande (`DELETE …/assignment-requests/me`). Une demande vers son propre groupe est refusée. Les règles existantes ne sont pas modifiées.

### Tests exécutés

| Suite | Résultat |
|---|---|
| Backend, build Docker | 343 tests, 0 échec, 3 ignorés |
| Front, 4 specs ciblées | 32 tests passés (composition 12, bannière 3, fiche 5, éditeur 12) |

Suite front complète non lancée.

### Vérifications par appels réels (compte membre)

| Vérification | Résultat observé |
|---|---|
| Lire la composition | 200 : 7 groupes, effectifs, places, modes, responsables |
| Composition d'un brouillon, membre puis organisateur ; identifiant inconnu | 404 partout |
| Quitter son groupe sur un brouillon | 404 |
| Annuler sa demande, puis une seconde fois | 200, puis 404 « Aucune demande en attente » |
| Demander un transfert | 200 ; le groupe actuel est conservé |
| Demander son propre groupe | 400 « Vous êtes déjà dans ce groupe » |
| Rejoindre un groupe complet, un groupe géré, un groupe à sous-groupes | 400 dans les trois cas |
| Quitter son groupe | 200 ; toujours Présent, vaisseaux inchangés (2 avant, 2 après) |
| Quitter une seconde fois | 404 |

### Vérifications à l'écran

| Vérification | Résultat observé |
|---|---|
| Demander un transfert depuis l'organigramme | Message de confirmation ; « Transfert demandé — vous gardez votre place » ; la carte visée affiche « Demande envoyée » |
| Annuler la demande, quitter, rejoindre | Chaque action relit le serveur et met à jour le bloc et l'organigramme |
| Une demande déjà en attente | Les autres groupes sur validation l'expliquent au lieu de proposer un bouton |
| 28 présents, dont un groupe de 16 | 8 noms puis « + 8 autres » ; aucun débordement |
| Mobile 375 px | Mon affectation en tête ; un seul groupe ouvert ; organisation de 1112 px repliée, 1606 px dépliée ; boutons de 40 px |

Quitter et annuler après l'heure de fin : refus couvert par le test unitaire (même verrou que les autres écritures), non rejoué en réel. Tablette et 4K : prévus en 3D-4.

### Revue indépendante

Aucun bloquant, 6 constats importants, 14 mineurs.

Importants corrigés :
1. Rejoindre un groupe libre annulait sans le dire une demande en attente : une confirmation le dit maintenant avant.
2. « Quitter mon groupe » ne prévenait pas des conséquences : la confirmation précise qu'il faudra une nouvelle validation, ou l'intervention d'un organisateur pour un groupe géré.
3. « Choisir un groupe » était proposé alors qu'aucun groupe n'était ouvert au choix : le bloc indique alors qu'un organisateur fera l'affectation.
4. « Complet » sans explication quand c'est le groupe principal qui est plein : libellé « Groupe principal complet », jauge fondée sur la capacité propre du groupe.

Importants laissés ouverts :
5. La lecture de la composition recopie une partie du calcul du tableau de coordination côté serveur.
6. Les fonctions d'effectif et de places existent en double côté écran (organigramme et tableau de coordination). Le libellé du mode géré est aligné : « Géré par les organisateurs ».

Mineurs corrigés : boutons relâchés trop tôt par une relecture sans rapport ; relecture lancée sur une autre fiche ; relecture en échec signalée par un bandeau avec « Réessayer » ; erreur et invitation à s'inscrire affichées en double ; repli qui suit la rotation de l'écran ; sous-groupes repliés gardés dans le document ; focus replacé sur « Mon affectation » après une action ; mon nom toujours visible avant « + N autres » ; étiquettes « Complet » et « Affecté » en double ; indications d'action affichées sur une opération terminée ; bloc « Mon affectation » étiré à la hauteur de la présence.

Mineurs laissés ouverts : l'entrée d'aperçu du bloc ne sert qu'au 3D-3 ; la spec de la fiche couvre « quitter » mais pas chaque action.

À décider : un membre peut quitter lui-même un groupe géré par les organisateurs. Il est prévenu qu'il ne pourra pas y revenir seul, mais rien ne l'en empêche.

### Captures

`3d2-desktop-presence-et-mon-affectation.jpg`, `3d2-desktop-organigramme.jpg`, `3d2-desktop-organigramme-28-participants.jpg`, `3d2-mobile-mon-affectation.jpg`, `3d2-mobile-organigramme.jpg`, `3d2-mobile-groupe-16-membres.jpg`.

### Données de test

20 comptes fictifs ajoutés à « Escorte Nyx » pour la lisibilité (`discord_id` commençant par `lot3d-test-`, mot de passe inutilisable), inscrits Présent et affectés : 14 à Équipe FPS, 6 à Infirmerie. Suppression : `delete from core.users where discord_id like 'lot3d-test-%';`

Les captures datent d'avant les corrections de la revue : l'étiquette « Affecté » a disparu, « Groupe » est devenu « Groupe principal », Infirmerie affiche « Groupe principal complet ».
