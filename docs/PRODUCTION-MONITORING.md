# Alertes de production

## Fonctionnement

Une sonde Python indépendante du backend et de Vault est lancée par
`iceforge-monitor.timer` sur le VPS. Elle contrôle chaque minute l’API publique
`https://iceforge.fr/api/front/members`, la santé du backend et du bot et l’état
de scellement de Vault. Elle ne lit aucun secret applicatif dans Vault.

Après deux contrôles consécutifs en échec, elle envoie un mail à l’adresse de
réception choisie à la configuration (paramètre `-Recipient`). Cette adresse n’est
pas écrite dans le dépôt, qui est public. La cause détectée est précisée dans le sujet et le
corps : Vault scellé, Vault indisponible, backend non sain, API publique indisponible
ou bot non sain. Si Vault est scellé, le mail donne la commande de déverrouillage.
Un Vault scellé est aussi signalé si les applications encore démarrées répondent :
leur prochain redémarrage serait bloqué.

Un incident inchangé n’envoie pas de nouveau mail à chaque contrôle. Un changement
de cause envoie une mise à jour. Le retour à la normale envoie un seul mail de
rétablissement. Les échecs d’envoi ne sont pas marqués comme livrés et seront retentés.
Les incidents très courts, rétablis avant le seuil d’alerte, ne génèrent pas de mail.
Avec Brevo, un mail de contrôle est envoyé après trente jours sans envoi réussi,
pour vérifier la chaîne et éviter l’inactivité de la clé SMTP (Brevo désactive les
clés sans envoi réussi pendant 90 jours). En l’absence de panne, ce mail est un test ;
si un incident persiste, il est présenté comme un rappel mensuel de cet incident.

Cette sonde tourne sur le VPS : elle détecte les pannes applicatives et les
redémarrages bloqués, mais ne peut envoyer de mail si le VPS lui-même est arrêté
ou n’a plus de réseau. Une sonde HTTPS externe reste nécessaire pour couvrir ces
deux cas. L’envoi Gmail doit être validé avant de considérer les notifications actives.

## SMTP local du VPS

Le mode retenu est désormais un Postfix d’envoi uniquement sur le VPS. Il ne
requiert ni compte Brevo, ni mot de passe Google, ni clé SMTP. Le backend et Vault
ne sont pas utilisés pour envoyer les alertes. La sonde soumet le message à
`127.0.0.1:25` ; Postfix le transmet directement aux MX de Gmail avec TLS obligatoire.
Le service n’écoute pas sur les interfaces publiques et aucun port entrant n’est ouvert.
IPv4 est imposé pour utiliser l’adresse dont le DNS inverse a été vérifié.

Contrôles préalables du 17 octobre : Gmail accepte la connexion sortante au port25
et EHLO ; le PTR de `82.29.170.11` pointe vers `srv740400.hstgr.cloud`, dont le A
public renvoie bien `82.29.170.11`. Aucun SPF n’est publié sur `iceforge.fr`.
Le nom public existant du VPS sert de nom SMTP ; il n’est pas nécessaire de modifier
le PTR ou d’ajouter un nom `mail.iceforge.fr` pour ce dispositif minimal.

Installer les scripts du répertoire `ops/production/monitoring` sur le VPS puis :

```bash
sudo bash /root/iceforge/ops/production/monitoring/install-local-smtp.sh
```

L’installation sauvegarde `main.cf`, refuse d’écraser un Postfix déjà configuré par
un autre opérateur et contrôle que l’écoute est exclusivement `127.0.0.1:25`.

### Réglage DNS requis

Ajouter cet enregistrement dans la zone DNS du domaine :

| Type | Nom | Valeur |
|---|---|---|
| TXT | `@` | `v=spf1 ip4:82.29.170.11 ~all` |

Il doit exister un seul enregistrement SPF. Si un SPF est déjà présent au moment
de l’intervention, fusionner l’autorisation IP avec ses mécanismes existants au
lieu d’en créer un second. Ne pas supprimer les autres TXT. Gmail demande au
minimum SPF ou DKIM, un DNS direct/inverse valide et TLS :
[consignes Google](https://support.google.com/mail/answer/81126?hl=fr).
DKIM et DMARC pourront renforcer l’authentification ultérieurement ; ils ne sont
pas requis pour cette première configuration à très faible volume avec SPF.

Une fois le TXT publié, lancer depuis le dépôt Windows :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\ops\production\monitoring\enable-local-mail-from-windows.ps1 -Recipient <adresse de réception>
```

La validation automatique accepte uniquement la politique simple ci-dessus (ou
sa variante `/32` et `-all`). Un SPF existant plus complexe exige une vérification
adaptée du script ; ne pas le remplacer pour contourner ce contrôle.

Le script vérifie le SPF public avant de soumettre un mail de test et de configurer
la sonde. Sans SPF, il laisse les alertes désactivées et affiche `WAITING_FOR_SPF`.
L’acceptation locale par Postfix est annoncée `QUEUED`, jamais comme une preuve
de réception Gmail. Vérifier la livraison dans les logs puis dans la boîte Gmail :

```bash
sudo journalctl -u postfix --since '10 minutes ago' --no-pager
sudo tail -n 60 /var/log/maillog
sudo postqueue -p
```

Le statut `sent` avec réponse 250 du MX Gmail confirme l’acceptation distante ;
vérifier aussi le dossier spam. Un statut `deferred` ou `bounced` doit être résolu
avant de considérer les alertes opérationnelles. La sonde conserve un mail de
contrôle mensuel pour vérifier que le canal fonctionne.

## Option Brevo

Le compte Google de l’opérateur ne permet pas de créer de mot de passe
d’application malgré la validation en deux étapes. L’envoi par défaut utilise
Brevo a été préparé comme solution alternative ; la réception reste l’adresse
donnée par `-Recipient`. Le SMTP local ci-dessus est désormais prioritaire.

1. Créer un compte [Brevo](https://www.brevo.com/fr/).
2. Ajouter et authentifier le domaine `iceforge.fr` avec les enregistrements DNS
   fournis par Brevo. Ne pas inventer ces valeurs ni remplacer les enregistrements
   mail existants. Suivre [l’authentification du domaine](https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC).
3. Ajouter l’expéditeur `alertes@iceforge.fr`, ou choisir une autre adresse validée
   du domaine et utiliser le paramètre `-Sender` du script.
4. Dans [SMTP et API → SMTP](https://app.brevo.com/settings/keys/smtp), relever le
   **login SMTP** indiqué et générer une **clé SMTP**. Ce n’est ni le mot de passe
   du compte Brevo ni une clé API. Le login peut être une adresse technique
   `…@smtp-brevo.com`, différente de l’expéditeur.
5. Dans PowerShell, lancer :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\floga\IdeaProjects\IceForge\ops\production\monitoring\configure-mail-from-windows.ps1" -Recipient <adresse de réception> -Provider Brevo
```

Le script demande le login, puis la clé SMTP avec saisie masquée. Vérifier la
réception du mail de test. La configuration n’est enregistrée qu’après un envoi
SMTP accepté ; les étapes DNS et la réception dans la boîte restent à confirmer.

Source : [configuration SMTP Brevo](https://help.brevo.com/hc/fr/articles/7924908994450-Envoyer-des-emails-transactionnels-avec-Brevo-SMTP),
[gestion et inactivité des clés](https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys).
Le serveur est `smtp-relay.brevo.com:587`, STARTTLS vérifié. Le mot de passe reste
dans `/etc/iceforge-monitor/config.json`, root 0600, hors Vault. Aucun secret SMTP
ne doit être transmis dans le chat.

## Option Gmail

Gmail reste disponible via `-Provider Gmail` si le compte l’autorise. La validation en deux étapes
du compte Google doit être activée pour créer un mot de passe d’application :
[aide Google](https://support.google.com/accounts/answer/185833?hl=fr).

1. Ouvrir https://myaccount.google.com/apppasswords avec le compte destinataire.
2. Créer un mot de passe d’application nommé « IceForge alertes ».
3. Dans PowerShell, lancer :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\floga\IdeaProjects\IceForge\ops\production\monitoring\configure-mail-from-windows.ps1" -Recipient <adresse de réception> -Provider Gmail
```

4. Coller le mot de passe d’application dans la saisie masquée. Ne pas utiliser le
   mot de passe habituel du compte ni le transmettre dans un chat.
5. Vérifier la réception du mail de test et le message d’activation du script.

La configuration est écrite seulement après un envoi SMTP réussi, dans
`/etc/iceforge-monitor/config.json`, root, mode 0600. Le mot de passe est transmis
sur stdin SSH, jamais dans les arguments des processus. Il reste sur l’hôte, hors
de Vault, pour que les alertes fonctionnent même si Vault est scellé. Ce fichier
n’est pas ajouté au dépôt. La configuration est à sauvegarder de façon chiffrée
ou à recréer avec un nouveau mot de passe d’application lors d’une reprise du VPS.

Google peut révoquer ce mot de passe après un changement du mot de passe principal ;
dans ce cas, en créer un nouveau et relancer la configuration. Si l’option n’est pas
disponible pour le compte Google, choisir un autre service d’envoi et adapter la
configuration ; ne pas désactiver les vérifications TLS.

## Installation serveur

Installer les quatre fichiers de `ops/production/monitoring/` dans
`/root/iceforge/ops/production/monitoring/`, appartenant à root, puis :

```bash
sudo bash /root/iceforge/ops/production/monitoring/install-monitor.sh
```

Sans configuration mail, le timer est installé mais la sonde est ignorée par
`ConditionPathExists`. Le message `WAITING_FOR_MAIL` signifie qu’aucun mail ne
peut encore être envoyé. Le script Windows démarre un contrôle après configuration.

Les fichiers d’état et de verrouillage résident dans `/var/lib/iceforge-monitor/`,
répertoire root 0700 ; l’état est remplacé atomiquement en 0600. Le verrou évite
deux contrôles concurrents. La sonde ne redémarre et ne déverrouille aucun service.

## Contrôles opérateur

```bash
sudo systemctl status iceforge-monitor.timer
sudo systemctl list-timers iceforge-monitor.timer
sudo journalctl -u iceforge-monitor.service --since '1 hour ago' --no-pager
sudo python3 /root/iceforge/ops/production/monitoring/production-monitor.py test-email
```

Le journal contient uniquement la cause et le code HTTP, ou une erreur générique
de configuration/envoi. Ne pas afficher le fichier de configuration pour déboguer.

## Validation

Les tests hermétiques `ops/testing/test-production-monitor.py` couvrent le seuil,
l’absence de spam, les changements de cause, le rétablissement, l’échec SMTP,
Vault scellé avec API encore disponible et le délai Docker dépassé. Aucun mail
réel n’est envoyé par ces tests. La réception réelle du mail de test reste une
étape obligatoire lors de l’activation. Dix-sept tests couvrent également l’expéditeur
Brevo distinct du login SMTP, le destinataire Gmail, le mail mensuel et sa reprise
après un échec d’envoi.
Le mode local est testé sans identifiants, avec en-têtes Date/Message-ID, autorisation
SPF exacte et refus d’envoyer ou de persister une configuration sans SPF.

Installation du 17 octobre 2026 : timer installé, activé au démarrage et actif,
unités validées par `systemd-analyze verify`. La sonde exécutée sur le VPS a constaté
backend et bot `healthy`, Vault déverrouillé et HTTP 200. La connexion TLS Gmail
depuis le VPS est validée sans authentification. La configuration et l’envoi réel
étaient alors en attente du mot de passe d’application.

L’adaptation Brevo est installée sur le VPS et sa connexion STARTTLS est validée,
sans authentification ni envoi. Aucun fichier de configuration mail n’est encore
présent à cette étape. Cette option a ensuite été remplacée par le SMTP local.
Les règles d’alerte sont inchangées ; les informations d’authentification
ne sont jamais reprises depuis le compte Google.

État final du 17 octobre : Postfix 3.5.25 installé et actif, écoute exclusivement
sur `127.0.0.1:25`, file vide, TLS sortant obligatoire. Sauvegarde initiale :
`/var/backups/iceforge/postfix-alerts.gNsqYZ/main.cf`. Le backend et le bot restent
`healthy` et l’API répond HTTP 200. Aucun secret SMTP n’est nécessaire. La sonde
attend le TXT SPF public avant de configurer l’envoi : `WAITING_FOR_SPF`.
Activation à 17:46 UTC : SPF publié et confirmé par les deux DNS autoritaires,
Google et Cloudflare. Configuration locale créée, timer actif, premier contrôle
`cause=OK http=200`. Mail de test accepté par le MX Gmail en TLS 1.3 à 17:46:34 UTC,
réponse `250 2.0.0 OK`, file Postfix vide. Les alertes sont activées ; la présence
du test dans la boîte de réception ou le dossier spam reste à vérifier par l’opérateur.

L’opérateur a confirmé la réception du premier test. Simulation du 17 octobre
à 17:51 UTC : appel de la fonction `transition` déployée avec un état en mémoire
et des observations fictives Vault scellé/API 502, puis retour à une observation
réelle saine. Aucun arrêt de service ni scellement de Vault. Premier échec sans
mail, second échec avec une alerte, échec identique sans doublon, rétablissement
avec un seul mail. État persistant de surveillance inchangé. Les deux mails,
marqués `SIMULATION 20261017T175117Z`, ont été acceptés par Gmail (250, TLS 1.3),
file Postfix vide. Leur réception reste à confirmer par l’opérateur. Ce scénario
valide les transitions et l’envoi réel ; il ne provoque pas de panne des sondes.
