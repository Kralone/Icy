# Lot 3, sous-lot 3B — affectations et coordination (2026-10-12)

Branche `feat/operations-lot3-organisation`. Rien n'est poussé.

## Ce qui est livré

- **Tableau de coordination** (onglet « Coordination » de l'éditeur) : présents, participants sans affectation, demandes en attente, groupes hiérarchisés avec leurs membres. Actions directes : affecter, déplacer, retirer, accepter, refuser.
- **Placement par l'organisateur** dans tous les modes, y compris « géré », qui n'avait jusque-là aucun chemin d'affectation.
- **Responsable délégué** : sur la fiche de l'opération, section « Coordination de mes groupes » limitée aux groupes qui lui sont confiés et à leurs sous-groupes.
- **Règles garanties côté serveur** : une seule affectation par membre, plafonds du groupe et du parent, pas de membre direct dans un groupe qui a des sous-groupes, membre inscrit Présent obligatoire, délégation contrôlée sur le groupe d'origine et de destination.
- **Corrections métier demandées** : la création d'un sous-groupe et les affectations sur son parent prennent le même verrou ; le déplacement d'un groupe sous un parent contrôle le plafond du parent et verrouille les deux groupes.

## Tests exécutés

| Suite | Résultat |
|---|---|
| Backend, build Docker | 329 tests, 0 échec, 3 ignorés |
| `OperationMemberAssignmentTest` (nouveau) | 10 tests, 0 échec |
| `OperationAssignmentServiceTest`, `OperationGroupServiceTest` | 11 et 12 tests, 0 échec |
| Front, 4 specs ciblées | 32 tests passés (coordination 5, organisation 12, éditeur 12, fiche 3) |

Suite front complète non lancée.

## Parcours vérifiés sur la pile dev

Jeu de test « Escorte Nyx » : 3 groupes, 4 sous-groupes, 7 inscrits Présent, 1 Peut-être, 1 compte désactivé.

| Vérification | Résultat observé |
|---|---|
| Affecter cinq membres depuis le tableau, dont un groupe « géré » | Effectifs et listes relus sur le serveur après chaque action |
| Groupe complet, groupe conteneur, membre non présent | 400 avec message |
| Dernière place demandée deux fois en même temps | 200 et 400, effectif 4 / 4 |
| Même membre affecté à deux groupes en même temps | 200 et 409, une seule affectation |
| Sous-groupe créé pendant une affectation sur le même groupe | Une seule des deux aboutit, aucun membre direct dans le conteneur |
| Transfert sur validation | Place conservée pendant l'attente, déplacement à l'acceptation |
| Retirer un membre | Il redevient « sans affectation », toujours Présent |
| Responsable délégué | Voit ses groupes, affecte un membre libre, retire dans sa délégation ; refusé hors délégation |
| Membre ordinaire | Refusé en lecture et en écriture |
| Révision de l'opération | Inchangée par les affectations |
| Mobile 375 px | Sans débordement, sélecteur de destination en liste |

Non vérifié par appel réel : le contrôle du plafond lors du déplacement d'un groupe et la détection d'un groupe déplacé pendant une affectation (tests unitaires seulement) ; écran 4K.

## Défaut antérieur corrigé

Un participant au compte désactivé faisait échouer en 500 la liste de présence, le report et la suppression de l'événement, événements classiques compris. Les trois répondent maintenant 200 (vérifié sur un événement classique de test avec un compte désactivé inscrit).

Deux écritures simultanées qui butent sur une contrainte de la base répondent 409 au lieu de 500. Conséquence : la création d'un événement classique avec un type inconnu répond 409 au lieu de 500.

## Revue indépendante

Aucun bloquant, 4 constats importants, 13 mineurs. Les 4 importants sont corrigés :

1. Le déplacement d'un groupe ne verrouillait que le nouveau parent (dépassement de plafond ou troisième niveau possibles en concurrence).
2. Un déplacement entre sous-groupes d'un parent plein était bloqué à l'écran alors que le serveur l'accepte.
3. Le correctif « compte désactivé » ne couvrait pas la suppression des participations.
4. Sur la fiche, le tableau de coordination d'une opération pouvait rester affiché sous une autre.

Mineurs corrigés : demande de transfert annulée par une affectation sans effet, réponse 500 sur double affectation, réponse qui révélait si un membre était affecté, boutons relâchés trop tôt, tableau qui disparaissait sans message, titre de la section pour un organisateur, sélecteur de destination vide, message trompeur sur un brouillon.

## Captures

`desktop-coordination-demande-et-sans-affectation.jpg`, `desktop-coordination-groupes.jpg`, `desktop-fiche-responsable-delegue.jpg`, `mobile-coordination.jpg`. Prises avant les corrections de la revue : la mention « ★ nom » est devenue « Responsable : nom ».

## Réception conditionnelle : comptes désactivés

Le serveur refuse toute nouvelle affectation d'un compte désactivé, même s'il est resté inscrit Présent : affectation par lui-même, demande, approbation d'une demande, affectation ou transfert par un organisateur ou un responsable. Les affectations existantes ne sont pas supprimées ; le membre s'affiche « Compte désactivé » et peut être retiré.

| Vérification sur la pile dev | Résultat observé |
|---|---|
| Affecter un compte désactivé inscrit Présent | 400 « Ce compte est désactivé : il ne peut pas recevoir d'affectation. » |
| Transférer un compte désactivé déjà affecté | 400, même message ; il reste dans son groupe |
| Approuver sa demande restée en attente | 400, même message ; le refus répond 200 |
| Affectation historique | Conservée, affichée « Compte désactivé », retirable par l'organisateur (200) |
| Affecter un compte actif | 200 |
| Événement classique : création, participation, liste, calendrier, report, suppression | 201 puis 200 |
| Backend, build Docker | 330 tests, 0 échec, 3 ignorés |

Courte revue indépendante : aucun bloquant. Ses deux constats importants portaient sur l'absence d'exécution de la requête ; les appels ci-dessus y répondent. Restent ouverts :

- La requête n'a pas de test d'intégration automatisé, seulement un test unitaire bouchonné et les appels réels.
- Une demande en attente d'un compte désactivé ne se ferme que par un refus manuel.
- Un responsable délégué qui connaît l'identifiant d'un participant peut apprendre que son compte est désactivé.
- La désignation d'un compte désactivé comme responsable de groupe n'a pas été examinée.

## Anomalies et risques ouverts

- Aucune règle sur une opération terminée : aucun contrôle serveur, les affectations y restent modifiables ; seul le panneau de présence est désactivé à l'écran. Règle à décider.
- Un refus d'accès répond 401 au lieu de 403 (comportement général de l'application).
- Le participant ne peut pas encore quitter son groupe ni annuler sa demande lui-même, et ne voit pas la composition : prévu au 3D.
- Le tableau garde ses trois compteurs en tête, qui répètent en partie les blocs du dessous.
- Après une action, le focus clavier n'est pas replacé sur le membre concerné.
- Données de test dans la base dev : 8 comptes fictifs (`discord_id` commençant par `lot3b-test-`, mot de passe inutilisable, 7 actifs, 1 désactivé) inscrits à « Escorte Nyx ». Suppression : `delete from core.users where discord_id like 'lot3b-test-%';`
