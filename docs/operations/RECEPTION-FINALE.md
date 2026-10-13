# Module Opérations — réception transversale (2026-10-12)

Branche `feat/operations-lot3-organisation`, commit de code `9bca12c`. Rien n'est poussé, fusionné ni déployé en production.

## 1. État Git

| Point | Constat |
|---|---|
| Branche de travail | `feat/operations-lot3-organisation`, arbre propre, 2 stashs intacts (`autostash`) |
| Commits du module | 237 depuis `d6485b2` (dernier commit hors module) |
| Répartition | 207 déjà sur le `main` local (jusqu'à `b4f4c0e`), 12 sur `fix/operations-v1-recovery` (lots 1 et 2), 18 sur la branche actuelle (lots 3A à 3D) |
| Branche vs `main` local | 30 commits d'avance, 0 de retard : fusion en avance rapide possible |
| `main` local vs `origin/main` | **249 commits d'avance, 0 de retard.** `origin/main` est resté au commit `3e6d216` du 8 septembre 2026 |
| Branches du module sur le dépôt distant | Aucune : ni la branche actuelle, ni `fix/operations-v1-recovery`, ni `feature/operations-v1` n'y existent |
| Travail local | Rien de perdu : aucun fichier non suivi hors dossiers ignorés, les deux stashs sont en place |

Conséquence : une PR de cette branche vers `origin/main` porterait 279 commits, dont 42 sans rapport avec les Opérations (catalogue, bot, flotte, guides, déploiement). Voir le plan de fusion.

### Migrations Flyway

| Point | Constat |
|---|---|
| Migrations du module | V40 à V42, 3 fichiers, sans trou ni doublon de version (regroupement des anciennes V40 à V53, correspondance dans `icy_backend/MIGRATIONS.md`) |
| Migrations antérieures | V1 à V39 non modifiées par le module |
| Base de développement | V53 appliquée (ancienne numérotation, au moment de la réception), aucune migration en échec |
| `origin/main` | S'arrête à V34 ; V35 à V39 ne sont que sur le `main` local |
| Production | Version appliquée non vérifiée dans cette session ; la documentation du dépôt mentionne des déploiements jusqu'à V38 |

## 2. Parcours vérifiés par appels réels

Opération créée pour l'occasion (« Réception finale »), comptes `validation_admin` (organisateur) et `validation_user` (membre), puis supprimée.

| Parcours | Résultat observé |
|---|---|
| Création d'un brouillon | 200, statut brouillon ; 401 pour un membre |
| Brouillon vu par un membre : fiche, composition, présences, réponse, calendrier | 404 partout, absent du calendrier même en le demandant |
| Autosauvegarde | 200, révision 1 → 2 ; révision périmée : 409 |
| Reprise | Briefing, rendez-vous et révision relus à l'identique ; brouillon listé pour l'organisateur |
| Structure | Groupe, deux sous-groupes, groupe géré : 201 ; troisième niveau : 400 ; création par un membre : 401 |
| Publication | 200 ; fiche visible du membre ; présente dans le calendrier |
| Présence | Peut-être, Indisponible, Présent : compteurs 0/1/0 → 0/0/1 → 2/0/0 |
| Affectation sans être Présent | 400 |
| Dernière place demandée deux fois en même temps | 200 et 400 « Groupe complet », effectif 1 / 1 |
| Groupe à sous-groupes ; groupe géré (soi-même) | 400 dans les deux cas |
| Transfert sur validation | 200 ; la place actuelle est gardée ; seconde demande : 400 |
| Validation par un membre non responsable | 401 ; par l'organisateur : 200, le membre change de groupe |
| Groupe géré | Placé par l'organisateur : 200 ; départ volontaire du membre : 200, toujours Présent |
| Responsable délégué | Dans sa délégation : 200 ; hors délégation : 401 |
| Capacité réduite sous l'effectif | 400 |
| Vaisseau d'un autre membre | 404 |
| Proposition depuis son hangar, liée à un besoin | 201 ; doublon : 400 |
| Validation par un membre | 401 ; par l'organisateur : 200, besoin 1 / 1 |
| Proposition et affectation | La proposition n'a pas changé le groupe du membre |
| Retrait par le propriétaire | 200, le besoin manque de nouveau |
| Consultation par le membre | Fiche, composition, vaisseaux, besoins : 200 ; structure de l'éditeur : 401 |
| Écriture 15 secondes avant la fin | 200 |
| Après la fin (drapeau `finished` encore faux) : 16 écritures, tous rôles | 409 partout, y compris changement de dates et suppression |
| Après la fin : briefing ; lectures | 200 ; composition et vaisseaux inchangés |
| Fiche à l'écran | Bannière, Mon affectation, briefing, objectifs, groupes, flotte affichés ; opération présente dans le calendrier |

Vérifiés plus tôt le même jour, code inchangé depuis : événement classique (création, deux réponses, changement de dates, suppression), modale du calendrier, hangar, liste des brouillons.

### Tests automatisés

| Suite | Résultat |
|---|---|
| Backend, build Docker | 344 tests, 0 échec, 3 ignorés |
| Front, suite complète (une fois, avant les dernières corrections du 3D-4) | 84 fichiers, 279 tests passés |
| Front, module, présence et calendrier (dernier état) | 13 fichiers, 91 tests passés |
| Tests du bot Discord (`icy/tests`) | **Non exécutés** : `pytest` n'est pas installé sur ce poste |

## 3. Discord

**Non vérifié en réel.** La pile de développement ne contient aucun bot : la file `events.queue` de RabbitMQ a 95 messages en attente et aucun consommateur. Rien n'a donc été publié dans un salon, de production ou non.

Ce qui est établi par lecture et par les réponses du serveur :
- Un brouillon n'émet aucun message ; l'annonce part à la publication.
- Le lien vers le site est construit par le bot : `ICEFORGE_PUBLIC_URL` (par défaut `https://iceforge.fr`) suivi de `/icy/operations/{id}`.
- Le bot est modifié par le module (`icy/messaging/event_handler.py`, deux fichiers de test).

Reste à faire avec un bot de test : publication d'une opération, bouton vers le site, réponse donnée dans Discord et retrouvée sur le site.

## 4. Sécurité et non-régression

| Point | Constat |
|---|---|
| Brouillons | Invisibles pour un membre sur toutes les lectures testées (404), absents du calendrier |
| Rôles | Création, édition, publication, structure, validation des vaisseaux : organisateurs seuls (401 pour un membre) |
| Action sur autrui | Un membre n'agit que sur lui-même ; un responsable seulement dans sa délégation |
| Écritures concurrentes | Dernière place, besoin de quantité 1, autosauvegarde périmée : une seule écriture aboutit |
| Clôture | Imposée par le serveur à l'heure de fin, sans dépendre du drapeau `finished` |
| Événements classiques | Sans régression sur les parcours testés |

Un refus d'accès répond 401 et non 403 : comportement général de l'application, antérieur au module.

## 5. Revue finale indépendante

Elle a relu les zones à risque du module entier (migrations, permissions, concurrence, Discord, événements classiques, routes). Aucun bloquant dans le module, 5 constats importants, 15 mineurs. **Aucun n'est corrigé : la mission était une vérification, pas un nouveau chantier.**

| # | Constat | Vérifié ici | Avis |
|---|---|---|---|
| I1 | Un message de participation Discord en échec (événement supprimé, contenu invalide) est remis en file sans fin. Touche aussi les événements classiques | Par lecture : le refus sans remise en file n'existe que dans l'autre écouteur | À corriger avant production |
| I2 | Annonce Discord d'une opération : les objectifs partent en JSON brut, et rien ne tronque un long briefing (limites Discord : 4096 et 1024 caractères). Un envoi trop long échoue et l'opération n'est jamais annoncée | Non vérifiable sans bot | À corriger avant production |
| I3 | Modifier le briefing, les objectifs, le lieu ou l'image d'une opération publiée ne met pas à jour l'annonce Discord | Par lecture | À décider |
| I4 | La page « Brouillons d'opération » répond 404 quand on la recharge ou qu'on l'ouvre par son adresse | **Confirmé par appel réel** : `/icy/admin/operation-drafts` → 404, alors que la fiche et l'éditeur répondent 200 | À corriger avant production |
| I5 | La route `/api/operations/{id}/convert` (transformer un événement en brouillon) est exposée aux organisateurs mais n'est appelée par aucun écran ; elle retire l'événement du calendrier et de Discord sans prévenir les participants | Par lecture : aucun appel côté écran | À supprimer ou à restreindre |

Constat de la revue infirmé par appel réel : la suppression d'une opération non terminée qui a des affectations fonctionne (200 sur « Réception finale »).

Mineurs notables : présence encore modifiable après la fin (voulu au 3C) ; réglages d'organisation ignorés en silence après la fin au lieu d'un refus ; responsable de groupe non validé ; image de mission acceptée en `http` ; deux noms de groupes principaux identiques possibles ; trois cas de concurrence rares (capacité abaissée pendant une affectation, acceptation et refus simultanés d'une demande, réordonnancement pendant une affectation).

## 6. Anomalies ouvertes

- Les cinq constats importants de la revue finale ci-dessus.
- Le statut de la bannière est celui du chargement de la page ; il ne change pas tout seul au passage de l'heure.
- Une écriture contrôlée juste avant l'heure de fin peut être validée quelques millisecondes après (limite acceptée).
- Une opération marquée terminée à la main alors que sa fin est à venir peut être remise « non terminée », puis supprimée.
- La liste des pilotes proposés à l'organisateur contient tous les membres ; le serveur refuse un pilote non Présent.
- Le hangar ne contient qu'un exemplaire par modèle et par membre.
- La désignation d'un compte désactivé comme responsable de groupe n'est pas contrôlée.
- Le calcul des places existe à deux endroits côté serveur, avec le même résultat.
- `GET /api/operations/{id}/groups/edit` n'a plus d'appelant côté écran.
- L'annonce Discord et la synchronisation des réponses n'ont pas été observées en réel.

## 7. Risques de déploiement

- **Périmètre réel de la mise en production** : si la production suit `origin/main` ou un état antérieur au `main` local, le déploiement embarque aussi les 42 commits hors module et les migrations V35 à V39. À vérifier avant tout.
- **Historique Flyway divergent entre `origin/main` et le `main` local** : les migrations V31 à V34 n'y portent pas le même contenu (`V31__create_external_catalog_sync` d'un côté, `V31__consolidate_catalog_cutover` de l'autre, et ainsi de suite). Si la production a été migrée depuis `origin/main`, le backend refusera de démarrer à la validation des migrations. À comparer avec la table `flyway_schema_history` de production. Ce point est antérieur au module.
- **Annonce perdue** : si RabbitMQ est indisponible au moment de la publication, l'annonce n'est pas rejouée.
- **Migrations V40 à V42** : 3 migrations appliquées d'un coup sur une base peuplée. À répéter d'abord sur une copie de la production.
- **Bot et backend** : le bot est modifié. Un backend à jour avec un ancien bot, ou l'inverse, n'a pas été essayé.
- **Variable `ICEFORGE_PUBLIC_URL`** : à définir sur le bot si le site n'est pas servi sur `https://iceforge.fr`.
- **Clôture automatique** : dès le déploiement, toute opération publiée dont la fin est passée devient en lecture seule, et ne peut plus être supprimée si elle a des réponses.
- **Changement de dates** : une opération garde désormais ses réponses ; un événement classique les remet toujours à zéro.

## 8. Données de test à nettoyer

Base de développement uniquement. Rien n'a été supprimé sans demande.

| Donnée | Détail |
|---|---|
| Comptes fictifs | 8 comptes `lot3b-test-*` et 20 comptes `lot3d-test-*` (mot de passe inutilisable) |
| Opérations et événements de test | 13 opérations et 3 événements classiques : `qdzqzdq`, `Aaaaa`, `QA Gate 1`, `Lot1 …` (4), `Lot2 …` (8), `Escorte Nyx` |
| File RabbitMQ `events.queue` | 95 messages sans consommateur : à purger avant de brancher un bot sur cette pile |
| Conteneurs de travail | `iceforge_lot2_node` (tests front) et `iceforge_lot1_avant-frontend` |

Suppression des comptes fictifs : `delete from core.users where discord_id like 'lot3b-test-%' or discord_id like 'lot3d-test-%';`

Deux opérations terminées (`Aaaaa`, `qdzqzdq`) : la première a une réponse et ne peut plus être supprimée par l'écran, par conception ; il faudra passer par la base.

## 9. Actions manuelles nécessaires

1. Décider du sort des 249 commits locaux non poussés du `main` (voir plan).
2. Lire la table flyway_schema_history de production : version appliquée, et contenu des migrations V31 à V34.
3. Faire tourner les tests du bot (`pytest icy/tests`) dans son environnement.
4. Vérifier Discord en réel sur un serveur de test.
5. Sauvegarder la base de production avant migration.

## 10. Plan de fusion et de déploiement proposé

Rien de ce qui suit n'est fait.

1. **Clarifier `main`.** Pousser le `main` local (249 commits) sur le dépôt distant s'il représente bien l'état voulu, ou dire quelle branche fait référence. Sans cela, la PR mélange le module et 42 commits étrangers.
2. **Corriger avant production** les constats I1, I2 et I4 de la revue finale, et trancher I3 et I5. Cela demande ton accord : ce n'est pas fait.
3. **Pousser la branche** `feat/operations-lot3-organisation` et ouvrir la PR vers `main` : 30 commits, texte prêt dans `docs/operations/PR-MODULE-OPERATIONS.md`. Pas de fusion automatique.
4. **Répétition** sur une copie de la base de production : migrations V40 à V42, démarrage du backend, parcours de la section 2, et rechargement de la page des brouillons.
5. **Discord sur serveur de test** : publication, lien, synchronisation des réponses.
6. **Fusion** de la PR après ta validation, en avance rapide ou par commit de fusion.
7. **Production** : sauvegarde, backend et bot déployés ensemble, puis frontend ; contrôle de l'historique Flyway et d'une opération de test en brouillon, non publiée.
8. **Retour arrière** : restauration de la sauvegarde. Les migrations V40 à V42 ajoutent des tables et des colonnes ; aucun script de retour n'est fourni.

## 11. Preuves archivées hors du dépôt

Les 92 fichiers de preuves de développement ont été retirés du dépôt le 2026-10-12 : 66 captures d'écran des lots 1 à 3D, les 22 revues intermédiaires de `reviews/`, trois notes d'étape (`00-audit.md`, `AUDIT-STATUS-2026-10-11.md`, `GATE-0-ADDENDUM.md`) et l'ancien texte de PR du lot 1.

| Point | Valeur |
|---|---|
| Archive | `operations-preuves-2026-10-12.zip` |
| Emplacement | `C:\Users\floga\IdeaProjects\IceForge-archives\`, hors du dépôt Git, sur le poste de développement |
| Empreinte SHA-256 | `5e98de66e94fc5febe9f7ba19750bde30fcc401d0160e4d1545d0f85d8b3c76e` |
| Manifeste | `operations-preuves-2026-10-12.sha256.txt`, à côté de l'archive et dans l'archive : une empreinte par fichier |
| Historique Git | Les mêmes fichiers restent lisibles au commit `3061df3` |

Les rapports de lot et la matrice de conformité citent ces captures et ces revues par leur nom : elles se trouvent dans l'archive, sous le même chemin.
