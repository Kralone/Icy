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
