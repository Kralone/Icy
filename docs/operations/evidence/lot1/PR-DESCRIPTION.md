# fix(operations) : lot 1 — création, présence et aperçu

## Contenu

- **Création d'opération** : liste de types fermée, chargée depuis le serveur. Le serveur refuse en 400 un type vide ou inconnu (`EventService.requireExistingEventTypeName`, appelé par `OperationController.create`) ; une différence de casse est tolérée et le nom enregistré est utilisé. Les événements classiques gardent leur comportement.
- **Présence** : le bloc Présence/Équipage de la modale est extrait à l'identique dans `shared/participation-panel/`, utilisé par la modale d'événement et par la fiche opération. La fiche relit les participations depuis le serveur après chaque réponse.
- **Éditeur** : dates en clair, statut « Brouillon » / « Publiée », retours d'action par toast.
- **Corrections issues des tests manuels** : sélecteur de types qui restait sur « Chargement des types… », message « Failed to fetch » remplacé par un message explicite quand le serveur est injoignable, erreur de présence affichée une seule fois.
- **Test Discord** : correction d'une erreur de compilation existante dans `EventPublisherTest`.

## Tests

- Backend (Java 25, build Docker) : 306 tests, 0 échec, 3 ignorés.
- Front : 4 specs opérations, 14 tests passés (`operation-create`, `operation-page`, `participation-panel`, `operation-editor`). Suite front complète non lancée.
- Parcours manuels sur la pile dev : création, présence à deux comptes, navigation, modale classique, publication.

## Preuves

Rapport et captures avant/après : `docs/operations/evidence/lot1/RAPPORT-LOT1.md`.

## Hors périmètre

- Lot 2 (autosave des brouillons).
- Les événements classiques renvoient toujours un 500 pour un type libre ou nul.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
