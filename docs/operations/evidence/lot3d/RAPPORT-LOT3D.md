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

## 3D-3 — Flotte et aperçu

Aucun changement côté serveur dans cette étape. La règle du 3D-2 est conservée : un membre peut quitter librement son groupe, y compris un groupe géré.

### Ce qui est livré

**Flotte de la fiche participant**
- Trois blocs : « Flotte prévue » (besoins), « Appareils proposés », « Mon hangar ». Les cartes du 3C sont réutilisées.
- Un besoin se distingue d'un appareil réel : contour en pointillés, image atténuée, mention « Recherché × N » (« Prévu × N » une fois couvert), statut « Couvert » ou « Manque n sur q ».
- Cartes de 17 à 24 rem sur grand écran ; sur mobile, vignette à gauche et texte à droite.
- L'organigramme rappelle sous chaque groupe les vaisseaux acceptés et disponibles qui lui sont rattachés, avec leur propriétaire.

**Aperçu de l'éditeur**
- L'ancien résumé textuel est remplacé par les composants de la fiche : bannière, « Mon affectation », présence, briefing, objectifs, organigramme, flotte.
- Il reflète les saisies en cours, enregistrées ou non, et fonctionne sur un brouillon.
- Il n'émet aucune action : présence désactivée, organigramme et flotte en lecture seule, pas de hangar.
- Pour une opération publiée, il montre les réponses déjà données ; pour un brouillon, aucun compteur.
- Une structure, une flotte ou des réponses non lues ne passent jamais pour vides : l'aperçu dit qu'il charge ou qu'il a échoué.

### Tests exécutés

| Suite | Résultat |
|---|---|
| Front, 7 specs ciblées | 54 tests passés (aperçu 4, composition 12, bannière 3, cartes de flotte 5, organisation 12, fiche 5, éditeur 13) |

Backend inchangé : build non relancé. Suite front complète non lancée.

### Vérifications sur la pile dev

| Vérification | Résultat observé |
|---|---|
| Fiche : besoins et propositions | « Flotte prévue » : Prospector « Prévu × 2 », Couvert ; Carrack « Recherché × 1 », Manque 1 sur 1. « Appareils proposés » : 2 Prospector acceptés, avec propriétaire, groupe et besoin lié |
| Vaisseaux, propriétaires et groupes | Sous Escadrille dans l'organigramme : les deux Prospector et leurs propriétaires |
| Action selon le participant | « Retirer ma proposition » sur mon seul appareil ; dans « Mon hangar », l'appareil déjà proposé est désactivé |
| Aperçu d'un brouillon (organisateur) | Bannière « Brouillon », briefing, organisation, flotte ; aucun compteur de présence |
| Écritures depuis l'aperçu, tous les boutons cliqués | Aucune : seules des lectures (besoins, vaisseaux, et réponses pour une opération publiée) |
| Boutons actifs dans l'aperçu | Aucun hors repli des groupes |
| Membre face au brouillon | 401 sur l'édition et l'organisation ; 404 sur la fiche, la composition, les vaisseaux et les besoins |
| Membre face à l'édition d'une opération publiée | 401 |
| Mobile 375 px | Aucun débordement ; section Flotte de 1316 px au lieu de 1990 px avant compactage |
| Événement classique depuis le calendrier | Modale historique, trois boutons, trois colonnes ; réponse enregistrée (200) |

Non rejoué dans cette étape : flotte après la clôture (serveur inchangé depuis le 3C, lecture seule couverte par les specs) ; tablette et 4K (3D-4).

### Captures

`3d3-desktop-flotte-prevue.jpg`, `3d3-desktop-appareils-et-hangar.jpg`, `3d3-desktop-apercu-brouillon.jpg`, `3d3-desktop-apercu-operation-publiee.jpg`, `3d3-desktop-apercu-organisation.jpg`, `3d3-mobile-flotte.jpg`, `3d3-mobile-apercu.jpg`.

Seules `3d3-desktop-flotte-prevue.jpg` et `3d3-desktop-apercu-operation-publiee.jpg` datent d'après les corrections de la revue. Sur les autres, le bloc s'appelle encore « Appareils mobilisés », le titre de l'aperçu est plus grand et les vaisseaux d'un groupe sont notés « (propriétaire) ».

### Revue indépendante

Aucun bloquant, 5 constats importants, 9 mineurs. Les 5 importants sont corrigés :
1. L'aperçu montrait une structure ou une flotte non lue comme vide.
2. Pour une opération publiée, il affichait « Confirmés 0 » tant que les réponses n'étaient pas lues.
3. Le titre « Appareils mobilisés » couvrait aussi les appareils refusés ou indisponibles : le bloc s'appelle « Appareils proposés ».
4. L'aperçu ignorait la clôture (textes au futur sur une opération terminée).
5. L'organigramme rappelait un vaisseau accepté même sorti du hangar, et son propriétaire pouvait passer pour le pilote.

Mineurs corrigés : besoin annulé encore marqué « Recherché » ; aperçu qui pouvait garder l'ancien titre après un rechargement ; réponses de l'aperçu sans garde contre une lecture tardive ; second titre de niveau 1 dans l'éditeur ; cartes laissant du vide dans les largeurs moyennes ; statuts « Complet » absents de l'aperçu.

Laissés ouverts :
- L'aperçu s'adapte à la largeur de la fenêtre, pas à celle de son cadre : dans l'éditeur il est plus étroit que la fiche réelle et ne montre pas la disposition à 1600 px.
- Les places de l'aperçu sont recalculées à l'écran à partir de la structure de l'éditeur, au lieu de venir du serveur.
- Le flux `groups$` de l'éditeur n'a plus d'abonné.

### Données de test

`validation_admin` est maintenant inscrit Présent à l'événement classique « Lot2 classique visibilite » (vérification de la modale).
