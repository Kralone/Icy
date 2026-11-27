# Relais Gmail vers Discord

Annonce dans un salon Discord privé chaque email reçu sur l'adresse de contact
publiée dans les mentions légales (`iceforgeindustries@gmail.com`). Le script
tourne dans Google Apps Script, sur le compte Gmail lui-même : aucun mot de
passe ni accès Gmail n'est donné au serveur IceForge.

Les emails peuvent contenir des demandes RGPD (accès, suppression). Le salon
doit donc être **privé et réservé aux responsables**, comme l'annonce la
politique de confidentialité.

## Installation (une fois, environ 5 minutes)

1. **Webhook Discord.** Dans le salon privé choisi : Modifier le salon →
   Intégrations → Webhooks → Nouveau webhook → Copier l'URL du webhook.
2. **Projet Apps Script.** Connecté au compte `iceforgeindustries@gmail.com`,
   ouvrir <https://script.google.com>, créer un projet nommé « Relais contact ».
3. **Code.** Remplacer le contenu de `Code.gs` par celui de ce dossier. Dans
   Paramètres du projet, cocher « Afficher le fichier manifeste
   appsscript.json » et remplacer son contenu par `appsscript.json`.
4. **Webhook en propriété.** Paramètres du projet → Propriétés du script →
   ajouter `DISCORD_WEBHOOK_URL` avec l'URL copiée à l'étape 1.
5. **Autoriser et planifier.** Dans l'éditeur, choisir la fonction
   `installTrigger` puis Exécuter, et accepter les autorisations demandées.
   Le relais tourne ensuite toutes les 5 minutes, et la purge chaque nuit
   vers 4 h.
6. **Tester.** Envoyer un email à l'adresse de contact, puis exécuter
   `relayNewMail` à la main ou attendre 5 minutes.

## Fonctionnement

- Seuls les emails de la boîte de réception des 7 derniers jours sont lus.
- Chaque conversation relayée reçoit le libellé Gmail « Relayé Discord ». Une
  réponse dans une conversation déjà relayée n'est pas annoncée de nouveau :
  retirer le libellé pour la relayer encore.
- Le message Discord ne donne que l'expéditeur, l'objet et un lien vers Gmail.
  Le contenu et les pièces jointes restent dans Gmail.
- Les mentions (`@everyone`, rôles) contenues dans un email sont neutralisées.
- En cas d'échec (webhook supprimé, Discord indisponible), Google envoie un
  email d'erreur au compte et le message est retenté au passage suivant.

## Durées de conservation

La fonction `applyRetention`, lancée chaque nuit, applique la politique de
confidentialité :

- les conversations relayées sont mises à la corbeille Gmail 12 mois après le
  dernier message (Gmail vide la corbeille au bout de 30 jours). Ajouter le
  libellé **« À conserver »** à une conversation qui doit être gardée plus
  longtemps, par exemple un litige en cours ;
- les annonces publiées dans Discord par le webhook sont supprimées après
  3 mois. Seules les annonces publiées depuis cette version sont suivies.
