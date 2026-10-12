# Lot 3, sous-lot 3C — flotte, hangars et clôture (2026-10-12)

Branche `feat/operations-lot3-organisation`. Rien n'est poussé.

## Ce qui est livré

**Clôture automatique**
- Dès l'heure de fin d'une opération publiée, le serveur refuse (409) toute modification des affectations, demandes, groupes, besoins et vaisseaux, pour tous les rôles.
- La fin fait foi : heure du serveur à Paris, comparée à la fin enregistrée. Le drapeau `finished` n'est pas utilisé.
- Les lectures restent possibles. Le briefing et les objectifs restent modifiables. Les dates d'une opération terminée ne peuvent plus être changées.
- Une demande en attente à la fin reste en base telle quelle ; l'écran l'affiche « Non traitée avant la fin de l'opération ».
- Après la fin, un changement de présence est toujours enregistré mais ne retire plus l'affectation.
- Écrans : bandeau « Opération terminée » dans l'éditeur, actions masquées dans l'arborescence, la fiche de groupe, la coordination, la flotte et la fiche participant.

**Flotte**
- Cartes illustrées (image et nom du catalogue) : besoins d'un côté, appareils proposés de l'autre, avec le besoin auquel un appareil répond.
- Par besoin : acceptés / quantité, « Manque N » ou « Couvert », propositions à valider.
- Accepter ou refuser une proposition : organisateurs seuls. Retrait : le propriétaire ou un organisateur.
- La quantité d'un besoin n'est jamais dépassée, y compris par deux écritures simultanées (verrou sur le besoin).
- Un appareil sorti du hangar ou dont le propriétaire n'est plus Présent reste affiché, signalé « Absent du hangar » ou « Propriétaire non présent », et ne peut plus être accepté.
- Fiche participant : section « Mon hangar » avec les appareils du membre, choix du besoin compatible et du groupe.
- Une proposition n'affecte personne à un groupe ; un retrait ne touche aucune affectation.

## Tests exécutés

| Suite | Résultat |
|---|---|
| Backend, build Docker | 339 tests, 0 échec, 3 ignorés |
| `OperationFleetAndClosureTest` (nouveau) | 9 tests, 0 échec |
| Front, 5 specs ciblées | 37 tests passés (flotte 5, coordination 5, organisation 12, éditeur 12, fiche 3) |

Suite front complète non lancée.

## Vérifications par appels réels sur la pile dev

Opération de test « Escorte Nyx », comptes `validation_admin` (organisateur) et `validation_user` (membre, responsable délégué de Bravo).

| Vérification | Résultat observé |
|---|---|
| Deux propositions simultanées pour un besoin de quantité 1 | 201 et 400 « Le besoin de vaisseau est déjà rempli » |
| Proposer deux fois le même appareil | 400 « Ce vaisseau est déjà proposé pour cette opération. » |
| Proposer l'appareil d'un autre membre | 404 « Vaisseau absent du hangar personnel » |
| Proposer sans être Présent | 400 |
| Proposer sur une opération qui n'autorise pas les propositions, ou un brouillon | 404 |
| Accepter en tant que membre ; retirer l'appareil d'un autre | 401 (refus d'accès de l'application) |
| Accepter : décompte du besoin | 1 / 1, manque 0 ; aucun groupe ne gagne de membre |
| Accepter un second appareil pour le même besoin | 400 « Ce besoin est déjà couvert par les vaisseaux acceptés. » |
| Propriétaire passé « Peut-être » | appareil toujours listé, `ownerPresent` faux |
| Retrait par l'organisateur | besoin de nouveau « manque 1 », effectifs des groupes identiques avant et après |
| Affectation 8 secondes avant la fin | 200 |
| Après la fin, drapeau `finished` encore faux : affecter, retirer (organisateur et délégué), rejoindre, demander, accepter et refuser une demande, créer / modifier / supprimer un groupe, créer / supprimer un besoin, proposer, accepter, refuser, retirer un appareil | 409 partout, « Opération terminée : son organisation n'est plus modifiable. » |
| Repousser la fin d'une opération terminée | 409 « Opération terminée : ses dates ne peuvent plus être modifiées. » |
| Modifier le briefing après la fin | 200 |
| Lectures après la fin (coordination, vaisseaux, besoins, groupes, fiche) | 200, effectifs et demande en attente inchangés |
| Changer sa présence après la fin | 200, composition inchangée |
| Événement classique : création, participation, liste, report, calendrier, suppression | 201 puis 200 |
| Brouillon vu par un membre (fiche, vaisseaux, besoins, proposition) | 404 partout ; 200 pour l'organisateur |
| Publier un brouillon dont la fin est passée | 400 « La fin de ce brouillon est déjà passée : corrigez ses dates avant de le publier. » |
| Donner une fin passée à une opération publiée | 400 ; dates et présences inchangées |
| Propriétaire qui retire sa proposition refusée | 400 ; le retrait d'une proposition acceptée ou en attente répond 200 |

La frontière exacte (une seconde avant, à l'heure, une seconde après) est couverte par le test unitaire à horloge fixe.

Non vérifié : écran 4K ; bascule en lecture seule d'une page restée ouverte au passage de la fin (codée, non rejouée à l'écran) ; envoi réel vers Discord (aucune annonce ajoutée, aucun message d'erreur dans le journal du serveur).

## Défaut antérieur corrigé

Un membre affecté à un groupe qui quittait « Présent » recevait une erreur 500 : sa réponse était enregistrée mais sa place n'était pas libérée. Il reçoit maintenant 200 et sa place est libérée (vérifié par appel réel). Les événements classiques ne sont pas concernés.

## Revue indépendante

Aucun bloquant, 5 constats importants, 14 mineurs.

Importants :
1. Une lecture de la flotte en échec s'affichait comme une flotte vide, définitivement. Corrigé : message d'erreur avec « Réessayer », et les lectures suivantes repartent.
2. Dans un brouillon aux dates passées, quitter « Présent » ne libérait plus la place. Corrigé.
3. Un brouillon dont la fin est passée pouvait être publié : il était annoncé puis aussitôt clôturé. Corrigé : publication refusée.
4. Avancer la fin d'une opération publiée dans le passé la clôturait sans retour et vidait les présences. Corrigé : refusé.
5. Le verrou partagé pris à la lecture de la fin n'a pas de test d'intégration. Non corrigé : la requête s'exécute sans erreur sur PostgreSQL (tous les appels réels ci-dessus y passent), mais la clause de verrou n'a pas été observée dans le SQL.

Mineurs corrigés : réglages d'organisation encore modifiables par l'API après la fin ; refus contournable par retrait puis nouvelle proposition ; acceptation d'un appareil lié à un besoin annulé ou d'un autre modèle ; bouton « Accepter » proposé sur un appareil que le serveur refuserait ; « Groupe supprimé » affiché pendant le chargement ; invitation à s'inscrire Présent affichée pendant le chargement ; retrait sans confirmation côté participant ; liste des membres demandée deux fois.

Mineurs laissés ouverts : voir les limites ci-dessous.

## Limites

- Une écriture contrôlée juste avant la fin peut être validée quelques millisecondes après. Tout contrôle qui commence à l'heure de fin ou après est refusé. Limite acceptée pour la V1.
- Un brouillon n'est jamais clôturé, même si ses dates sont passées ; il le devient à sa publication.
- Le hangar ne contient qu'un exemplaire par modèle et par membre : deux appareils identiques ne se distinguent que par leur propriétaire.
- Le statut d'un besoin (ouvert, rempli, annulé) reste manuel ; « Couvert » est calculé à partir des appareils acceptés.
- La liste des pilotes proposés à l'organisateur contient tous les membres ; le serveur refuse un pilote qui n'est pas Présent.
- La suppression d'une opération terminée reste possible pour un organisateur et efface sa composition. Règle à décider.
- Réduire la quantité d'un besoin sous le nombre d'appareils déjà acceptés n'est pas refusé : la carte affiche alors par exemple « 3 / 2 ».
- Le verrou de fin est injecté après la construction des services : un test qui construit un service à la main sans le fournir tourne sans verrou.
- Le changement de présence n'est pas une seule transaction : si la libération de la place échoue, la réponse reste enregistrée.
- Un changement de dates avant la fin vide les présences mais laisse affectations et propositions (comportement antérieur).
- « n / q acceptés » et « Manque n » disent en partie la même chose sur la carte d'un besoin.
- La désignation d'un compte désactivé comme responsable de groupe n'est toujours pas contrôlée (repris du 3B).

## Captures

`desktop-groupe-besoins-et-appareils.jpg`, `desktop-vue-ensemble-besoins.jpg`, `desktop-coordination-appareils-a-valider.jpg`, `desktop-fiche-mon-hangar.jpg`, `desktop-operation-terminee-bandeau.jpg`, `desktop-operation-terminee-flotte.jpg`, `mobile-fiche-besoins.jpg`, `mobile-fiche-mon-hangar.jpg`.

La capture de la coordination date d'avant l'alignement de la case « Autoriser les membres… » sur son libellé.

## Données de test

Sur « Escorte Nyx » : 2 besoins (Prospector, Carrack) et 2 appareils proposés (un accepté, un en attente) ; `validation_admin` y est inscrit Présent et affecté à Escadrille. Les dates de l'opération ont été avancées deux fois pour les vérifications, puis remises au 20 novembre ; le drapeau `finished` est resté faux. Les 8 comptes fictifs du 3B sont toujours présents.
