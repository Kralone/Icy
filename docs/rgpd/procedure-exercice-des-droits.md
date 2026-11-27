# Procédure d'exercice des droits

Délai de réponse : **1 mois** à compter de la réception (prolongeable de 2 mois si complexe, en prévenant la
personne). Gratuit.

## 1. Réception

Les demandes arrivent sur iceforgeindustries@gmail.com (annoncées dans le salon Discord privé). Ajouter le libellé
Gmail « À conserver » pour qu'elles ne soient pas purgées pendant le traitement.

## 2. Vérifier l'identité

Demander une confirmation depuis le compte Discord lié au compte du site (message privé au bot ou à un directeur).
Ne pas demander de pièce d'identité sauf doute sérieux.

## 3. Traiter

Il faut un compte avec le rôle `ADMIN` et son jeton d'accès (`$TOKEN`). L'identifiant du membre (`$USER_ID`) se
trouve dans l'administration des membres.

**Accès / portabilité** : export JSON de toutes les données du membre, sans secrets.

```sh
curl -H "Authorization: Bearer $TOKEN" \
  https://iceforge.fr/api/admin/privacy/members/$USER_ID/export -o export.json
```

Envoyer le fichier à la personne, puis le supprimer.

**Effacement** : compte désactivé et anonymisé tout de suite, avatar effacé. L'historique partagé (sessions,
banque) est gardé sous forme anonyme.

```sh
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"userIds\":[\"$USER_ID\"]}" https://iceforge.fr/api/admin/privacy/erasures
```

**Rectification** : corriger dans l'administration, ou laisser le membre le faire depuis son profil.

**Opposition / limitation** : désactiver le compte ou la fonction concernée, et noter la décision.

## 4. Registre privé des effacements

Après chaque effacement, ajouter une ligne (date, identifiant du membre) au **registre privé**, gardé hors du
serveur et hors de ce dépôt public. La table `core.erasure_log` de la base n'y suffit pas : une restauration
l'efface aussi.

## 5. Après une restauration de sauvegarde

Rejouer l'appel d'effacement avec tous les identifiants du registre privé dont la date est postérieure à la
sauvegarde restaurée. L'appel est sans effet sur un compte déjà anonymisé ; on peut donc rejouer tout le registre.

## 6. Répondre

Confirmer à la personne ce qui a été fait, ou expliquer le refus et rappeler le droit de saisir la CNIL
(https://www.cnil.fr/fr/plaintes).

## Purge automatique

La purge quotidienne n'efface vraiment qu'avec `ICEFORGE_RETENTION_MODE=apply` dans l'environnement de production.
En mode `report` (défaut), elle se contente de journaliser les volumes.
