# Fixtures de validation locales

Ces données sont exclusivement destinées à la pile Docker jetable nommée
`iceforge_validation`. Elles ne font pas partie de Flyway et ne doivent jamais être
injectées dans une base partagée ou de production.

Le script vérifie le label Compose du conteneur avant toute écriture. Le SQL est
transactionnel, échoue dès la première erreur et peut être rejoué sans créer de
doublons.

## Démarrage et injection

```powershell
docker compose -p iceforge_validation -f docker-compose.yml -f docker-compose.validation.yml up -d db rabbitmq backend
.\ops\testing\seed-validation.ps1
```

## Comptes jetables

| Utilisateur | Rôle | Mot de passe |
|---|---|---|
| `validation_user` | USER | `password` |
| `validation_officier` | OFFICIER | `password` |
| `validation_admin` | ADMIN | `password` |

Ce mot de passe volontairement faible n'est pas un secret et ne doit être utilisé
nulle part ailleurs. Les identifiants Discord commencent par `99` et sont fictifs.

Le jeu couvre profils et préférences, flotte et vaisseaux, catalogue d'objets,
objectifs et participations, événements internes et événements mondiaux,
actualités, collections, points de vente et grille cargo.

## Smoke tests API et rôles

Une fois la pile saine et les fixtures injectées :

```powershell
.\ops\testing\test-validation-api.ps1
```

Le script refuse toute URL non locale et vérifie que le port ciblé appartient bien
au frontend actif portant le label Compose `iceforge_validation`, ainsi que le
backend sain de cette même pile. Il authentifie les
trois comptes, vérifie des routes publiques, les refus anonymes et la matrice de
rôles. Les mutations utilisent uniquement des payloads invalides qui doivent être
rejetés avant persistance. Aucun mot de passe, token ou corps de réponse n'est
affiché. La couverture exacte est documentée dans
[`VALIDATION-API-MATRIX.md`](VALIDATION-API-MATRIX.md).

Le même harnais vérifie aussi plusieurs routes SPA, la redirection canonique 308,
les directives de cache du shell privé, du manifeste PWA et des API. Une URL
inconnue rend la page Angular dédiée tout en conservant un vrai statut HTTP 404.

Le bot peut ensuite être testé dans son image Python 3.14 contre le backend et
RabbitMQ de cette même pile, sans démarrer Discord :

```powershell
.\ops\testing\test-bot-integration.ps1
```

Le script vérifie les labels et la santé des services locaux, construit l'image du
bot, puis injecte les URL de test uniquement à l'intérieur du conteneur jetable.
Les identifiants RabbitMQ et la clé bot ne sont pas affichés.

## Migration historique et premier administrateur

Le test suivant crée une pile jetable distincte, simule une base V1 non vide sans
historique Flyway, vérifie le baseline puis les migrations jusqu'à V29, et exerce
le script d'amorçage administrateur de bout en bout :

```powershell
.\ops\testing\test-admin-bootstrap.ps1
```

La pile `iceforge_admin_bootstrap_test` et ses volumes sont supprimés à la fin.
Les piles `iceforge_dev` et `iceforge_validation` ne sont jamais ciblées.
