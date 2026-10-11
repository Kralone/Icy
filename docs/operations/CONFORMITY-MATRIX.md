# Matrice de conformite - Operations V1

Source auditee : commit `9206bd2` sur `codex/operations-reprise-audit`. Statuts normalises : PRESENT = inspecte dans le code, PARTIEL = implementation incomplete, ABSENT = non implemente, NON VERIFIE = preuve d execution manquante.

| ID | Exigence | Source | Preuve / limite | Etat | Severite | Action | Gate | Revue |
|---|---|---|---|---|---|---|---|---|
| NAV-01 | clic opération | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| NAV-02 | clic événement inchangé | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| NAV-03 | lien direct rechargement | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| NAV-04 | retour calendrier | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| NAV-05 | navigation mobile | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| CRT-01 | formulaire commun | event-management.component.html | Bouton conversion present ; formulaire commun partiel | PRESENT | P1 | Ajouter image/options partagees et test E2E | 2 | En attente |
| CRT-02 | bouton conversion | EventManagementComponent.convertToOperation | createOperation vers /api/operations/create | PRESENT | P1 | Tester conservation et erreur/rollback | 2 | En attente |
| CRT-03 | conservation TOUTES données | CreateEventRequest / event-management | Titre/type/description/dates conserves ; image/options absentes | PARTIEL | P1 | Etendre DTO ou documenter les champs non portables | 2 | En attente |
| CRT-04 | brouillon persistant | OperationService.convert | Operation DRAFT persistant | PARTIEL | P1 | Tester brouillon prive et reprise | 2 | En attente |
| CRT-05 | erreur autosave | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 2 | En attente |
| CRT-06 | éditeur complet | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 2 | En attente |
| CRT-07 | aperçu | operation-editor.component | Apercu participant reel absent | ABSENT | P0 | Gate 2/6 : reutiliser template participant | 2 | En attente |
| CRT-08 | publication explicite | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 2 | En attente |
| CRT-09 | modification opération publiée | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 2 | En attente |
| CRT-10 | date obligatoire | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 2 | En attente |
| UI-01 | style IceForge | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| UI-02 | hero image | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| UI-03 | page participant pleine largeur | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| UI-04 | sections briefing/objectifs | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| UI-05 | organigramme lisible | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| UI-06 | cartes vaisseaux avec images | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| UI-07 | participation visible | operation-page.component | Boutons et compteurs ; capture absente | PRESENT | P1 | Produire captures et E2E | 1 / 6 | En attente |
| UI-08 | affectation visible | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| UI-09 | responsive 3 tailles | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| UI-10 | contrastes et accessibilité | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| UI-11 | états vides/chargement/erreur | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| UI-12 | éditeur en zones claires | operation-editor.component | Onglets presents ; organisation deux panneaux absente | PARTIEL | P1 | Gate 3 : refondre editeur | 1 / 6 | En attente |
| UI-13 | icônes/émoticônes | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| UI-14 | cohérence visuelle autres pages | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| GRP-01 | deux niveaux | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 3 / 4 | En attente |
| GRP-02 | parent avec enfants non assignable | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 3 / 4 | En attente |
| GRP-03 | capacité facultative | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 3 / 4 | En attente |
| GRP-04 | capacité parent | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 3 / 4 | En attente |
| GRP-05 | membres sans doublon | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 3 / 4 | En attente |
| GRP-06 | une affectation principale | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 3 / 4 | En attente |
| GRP-07 | 3 modes | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 3 / 4 | En attente |
| GRP-08 | override par groupe | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 3 / 4 | En attente |
| GRP-09 | transition atomique | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 3 / 4 | En attente |
| GRP-10 | attente conserve ancienne place | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 3 / 4 | En attente |
| GRP-11 | délégation explicite | OperationGroup / migrations V40-V47 | Delegation explicite absente | ABSENT | P0 | Gate 3 : ajouter delegation scoped | 3 / 4 | En attente |
| GRP-12 | visibilité composition | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 3 / 4 | En attente |
| GRP-13 | participant sans affectation | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 3 / 4 | En attente |
| GRP-14 | baisse capacité | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 3 / 4 | En attente |
| GRP-15 | suppression / conversion groupes | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 3 / 4 | En attente |
| SHP-01 | proposition seulement si autorisé | OperationShipService + V46 | Permission organisateur false par defaut | PRESENT | P1 | Ajouter test refus/autorisation | 5 | En attente |
| SHP-02 | provenance hangar personnel uniquement | OperationShipService.propose | Ownership user_ships verifie | PRESENT | P1 | Ajouter test dynamique | 5 | En attente |
| SHP-03 | propriétaire ≠ pilote | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 5 | En attente |
| SHP-04 | propriétaire non auto-affecté | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 5 | En attente |
| SHP-05 | 0..n vaisseaux par groupe | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 5 | En attente |
| SHP-06 | besoins séparés des propositions | V46/V47 | Besoins distincts des propositions non modelises | ABSENT | P0 | Gate 5 : creer le modele | 5 | En attente |
| SHP-07 | retrait indisponibilité | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 5 | En attente |
| SHP-08 | association à un poste sans seconde affectation | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 5 | En attente |
| CAL-01 | type différencié | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| CAL-02 | colonnes et boutons conservés | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| CAL-03 | stats préservées | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 1 / 6 | En attente |
| DSC-01 | liste des activités | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 7 | En attente |
| DSC-02 | boutons 3 participations | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 7 | En attente |
| DSC-03 | embed qui présente l'opération | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 7 | En attente |
| DSC-04 | bouton lien direct | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 7 | En attente |
| DSC-05 | synchronisation bidirectionnelle | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 7 | En attente |
| DSC-06 | annulation libère place | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 7 | En attente |
| SEC-01 | permissions organisateur serveur | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 2-7 | En attente |
| SEC-02 | délégation scope | OperationController / services | Scope delegation absent | ABSENT | P0 | Gate 3 : controles serveur | 2-7 | En attente |
| SEC-03 | contrôle ownership hangar | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 2-7 | En attente |
| SEC-04 | anti-surbooking transactionnel | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 2-7 | En attente |
| SEC-05 | brouillon non public | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 2-7 | En attente |
| SEC-06 | validation DTO / XSS | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 2-7 | En attente |
| SEC-07 | CSRF/CORS si applicable | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 2-7 | En attente |
| SEC-08 | échec serveur correctement affiché | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 2-7 | En attente |
| SEC-09 | audit/log sans secret | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 2-7 | En attente |
| SEC-10 | contrôle accès deep-links | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 2-7 | En attente |
| REG-01 | événements CRUD | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 7 | En attente |
| REG-02 | participations | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 7 | En attente |
| REG-03 | Discord historique | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 7 | En attente |
| REG-04 | hangar | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 7 | En attente |
| REG-05 | calendrier | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 7 | En attente |
| REG-06 | auth | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 7 | En attente |
| REG-07 | mobile | Audit statique a completer | Aucune preuve reproductible consolidee | NON VERIFIE | P1 | Definir test ou capture au gate correspondant | 7 | En attente |
| REG-08 | migrations sur données anciennes | Flyway V46/V47 | Base historique non rejouee | NON VERIFIE | P0 | Migration integration | 7 | En attente |

## Revue de dossier

- Baseline visuelle calendrier/fiche événement : à capturer ; tentative temporaire 14200 non accessible depuis le navigateur intégré.
- Tests courants : Maven direct sur la branche après correction : 8 tests, 0 échec, 0 erreur pour EventServiceTest, OperationGroupServiceTest et OperationShipServiceTest ; build Angular de production réussi avec avertissements CSS budgétaires.
- Les 79 lignes sont atomiques et chaque gate conserve sa revue indépendante. Les statuts PRESENT ne remplacent pas une preuve runtime.
