# Bot Discord IceForge

## Runtime de référence

- Python 3.14.7
- dépendances directes épinglées dans `requirement.txt`
- environnement Docker reproductible épinglé dans `requirements.lock`

## Installation locale

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
```

Le bot refuse volontairement de démarrer si `BOT_API_KEY` est absent. Les
autres secrets et identifiants Discord doivent également être fournis par
l'environnement et ne doivent jamais être ajoutés au dépôt.

La création d'événements depuis Discord n'est pas exposée : l'ancien cog ne
disposait ni d'un contrat d'authentification backend compatible, ni d'un modèle
de permissions Discord fiable. Les événements doivent être créés depuis
l'interface web authentifiée jusqu'à la définition explicite d'un contrat bot.

## Commande d'administration

La slash command `/ajouter_utilisateur` est réservée aux administrateurs du
serveur Discord. Elle demande un membre, un grade IceForge et, facultativement,
un pseudo différent de son handle Discord. Le compte est créé par la route bot
authentifiée du backend, puis le membre reçoit en message privé son identifiant
IceForge et son mot de passe temporaire.

L'ancien serveur HTTP `/notify-password` a été supprimé. La notification de
réinitialisation transite uniquement par la file RabbitMQ interne.

## Validation sans connexion à Discord

```powershell
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m compileall -q -x "(^|[\\/])\.venv([\\/]|$)" .
```

Lors d'une mise à jour, modifier d'abord `requirement.txt`, régénérer
`requirements.lock` sous Python 3.14, puis exécuter toute la validation avant
de remplacer le verrou existant.

## Livraison RabbitMQ

Un échec de handler est retenté trois fois par défaut, avec un délai de cinq
secondes, puis envoyé dans la file durable
`icy.exchange.bot.dlx.queue`. Les variables `BOT_RABBIT_RETRY_LIMIT` (0 à 10)
et `BOT_RABBIT_RETRY_DELAY_MS` (100 à 300000) permettent d'ajuster cette
politique. Un JSON invalide va directement en DLQ.

Cette livraison est **at-least-once**, pas exactly-once. Pour les créations
d'actualités et d'événements, le bot enregistre le lien Discord dans
`/app/config/discord-links.sqlite3` avant le callback `*.discordLinked`. Un retry
réutilise donc le message déjà créé au lieu de le publier en double. Le fichier
est conservé par le volume `bot_config`. Une interruption exactement entre la
réponse Discord et l'écriture SQLite reste une limite théorique des deux systèmes
non transactionnels.
