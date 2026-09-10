# CIG Watch : collecte et publication

Le backend collecte Comm-Link et Devtracker toutes les cinq minutes. Une collecte initiale et le stock historique restent dans le flux administrateur sans publication automatique. Les nouveaux articles récents sont traduits puis publiés sous le type CIG Watch. Aucun texte anglais de secours n’est enregistré comme une traduction française réussie.

## Configuration

| Variable backend | Défaut | Effet |
| --- | --- | --- |
| CIG_WATCH_TRANSLATION_URL | http://libretranslate:5000 | Adresse du service LibreTranslate auto-hébergé, sans clé ni facturation par appel. |
| CIG_WATCH_PUBLISHING_ENABLED | true | Autorise la création des mini-actualités françaises sur le site. |
| CIG_WATCH_DISCORD_ENABLED | false | Autorise leur relais via RabbitMQ vers le bot. Garder false en développement. |

Ces variables doivent être transmises au conteneur backend (configuration Compose). Le bot doit avoir DISCORD_NEWS_CHANNEL_ID configuré, les droits d’envoyer des messages et des liens intégrés, et sa connexion RabbitMQ. Le profil dev-discord est optionnel : l’absence de bot actif ne doit jamais être interprétée comme une livraison réussie.

## Diagnostic

GET /api/news/cig/feed retourne translationConfigured, publishingEnabled, discordRelayEnabled et refreshing. translationConfigured indique que l’adresse du service est renseignée, pas sa disponibilité : une panne reste visible sur l’entrée. generatedAt indique le dernier essai de collecte, même si aucun nouvel article n’a été trouvé. errors concerne les sources ; lastError sur une entrée concerne sa traduction, sa publication ou son relais.

POST /api/news/cig/feed/refresh met une collecte en file et répond immédiatement. Interroger ensuite GET feed tant que refreshing vaut true, sans répéter POST.

Statuts : traduction PENDING / FAILED / TRANSLATED ; publication ARCHIVED / PENDING / PUBLISHED ; relais DISABLED / PENDING / DELIVERED / EXPIRED. newsId relie une entrée à la seule actualité créée. Une actualité supprimée manuellement n’est pas recréée.

## Reprises et limite du rattrapage

Chaque passage traite au maximum trois traductions/publications puis trois relais. Une erreur est reprise avec délai croissant de cinq minutes à six heures. La création de l’actualité et son lien à l’entrée sont dans la même transaction, verrouillée par entrée. Les premiers éléments d’une source et les éléments datant de plus de 24 heures ne déclenchent aucune annonce. Sans date de publication, un identifiant source plus récent que les identifiants déjà collectés est nécessaire.

Le relais réutilise toujours le même newsId. Le bot dispose d’un discord_link_store persistant qui déduplique ses reprises. DELIVERED nécessite le retour news.discordLinked et les identifiants Discord enregistrés côté news ; un simple envoi RabbitMQ ne suffit pas. Le message RabbitMQ expire au terme des 24 heures suivant la création de l’actualité. Passé cette fenêtre, le relais devient EXPIRED et n’est plus relancé. L’actualité reste sur le site.

La chaîne ne garantit pas une livraison exactement une fois lors d’un crash du bot entre l’envoi Discord et l’écriture de son lien local ; ce cas relève du relais existant. Le stockage de liens du bot doit être persistant.

## Validation locale sans émission réelle

Utiliser les tests mockés :

```text
./mvnw -Dtest=CigWatchServiceTest,CigWatchTranslationServiceTest,CigWatchPublicationServiceTest,NewsMessagingServiceTest test
```

Ils couvrent le HTML Comm-Link, la traduction en lot, les champs vides, les réponses invalides et les délais dépassés, la reprise sans publication anglaise, la publication unique, les archives, l’attente de confirmation Discord et l’expiration. Ils ne contactent ni LibreTranslate ni Discord.

Pour un test manuel Discord ultérieur autorisé : choisir l’environnement et un salon de test, vérifier les droits et le stockage des liens du bot, activer le relais dans cet environnement uniquement, puis suivre une nouvelle actualité française jusqu’à DELIVERED. Contrôler qu’un rafraîchissement suivant conserve le même newsId et le même message Discord. Ne pas réactiver en masse les entrées ARCHIVED ni modifier leurs identifiants pour provoquer un test.

## Traduction auto-hébergée

CIG Watch utilise exclusivement LibreTranslate pour traduire : aucun appel OpenAI, aucune clé payante et aucun repli vers un fournisseur externe. Le logiciel est gratuit ; il utilise les ressources de la machine qui l’héberge. Charger les modèles anglais et français (`LT_LOAD_ONLY=en,fr`) et conserver leur stockage entre redémarrages. Le premier démarrage nécessite le téléchargement des modèles. Garder le service sur le réseau interne des conteneurs, sans exposer son port publiquement.

Le backend appelle `POST /translate` avec les champs non vides dans `q`, `source=en`, `target=fr` et `format=text`. Il exige un tableau `translatedText` de même taille avec des textes non vides. Délais : connexion 10 secondes, réponse 90 secondes. Une erreur conserve le texte original sans le déclarer traduit et suit les reprises existantes.

Documentation officielle : [installation](https://docs.libretranslate.com/guides/installation/) et [API de traduction](https://docs.libretranslate.com/api/operations/translate/).

## Images et bot local

L’image propre à chaque actualité CIG provient du HTML de la carte Comm-Link déjà collectée. Elle est conservée dans `news.news.image_url` (V32), exposée par `NewsDTO.imageUrl` et transmise au bot. Le tableau de bord et Discord utilisent cette image avant celle du type. Les avatars Devtracker ne deviennent pas des illustrations d’actualité. À chaque traitement, jusqu’à 50 anciennes actualités CIG sans image sont examinées pour un enrichissement depuis leur HTML conservé ; cette opération ne republie pas leurs annonces Discord.

Le bot local est volontairement opt-in (`dev-discord`) et possède une sortie réseau externe pour joindre Discord. La stack peut fonctionner sans lui. Pour le démarrer après validation du token et du salon :

```powershell
docker compose -p iceforge_dev --env-file secrets/local.secrets.env -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.dev.yml --profile dev-discord up -d bot
```

`DISCORD_TOKEN` est défini dans `secrets/local.secrets.env` pour cette stack. Une réponse Discord HTTP 401 à `GET /api/v10/users/@me` signifie que le token configuré n’est pas accepté : le remplacer par un token valide du bot prévu avant démarrage. Ne pas imprimer la valeur ni la copier dans les journaux. Vérifier ensuite `GUILD_ID` et `DISCORD_NEWS_CHANNEL_ID` par une lecture Discord, puis réaliser uniquement le test explicitement autorisé. Garder `CIG_WATCH_DISCORD_ENABLED=false` tant que le relais automatique n’est pas prêt ; ne pas réactiver le stock historique pour tester.


### Contrôle éditorial et livraison ciblée

L’écran CIG Watch permet de corriger le titre et l’extrait français d’une entrée non publiée. LibreTranslate reste gratuit et auto-hébergé ; sa traduction peut être maladroite, notamment sur les noms propres. Enregistrer une correction arrête la publication automatique de cette entrée jusqu’à l’action explicite « Publier ». Les actualités déjà publiées se modifient depuis la gestion des actualités.

- `PUT /api/news/cig/entries/{id}/translation` : `{titleFr, excerptFr}`, titre 150 caractères maximum, extrait 600, texte requis. Aucun envoi.
- `POST /api/news/cig/entries/{id}/publish` : une entrée récente (moins de 24 heures depuis sa collecte), traduite et non publiée, si publication activée. Une deuxième demande ne crée aucune actualité supplémentaire.
- `POST /api/news/cig/entries/{id}/retry` : reprend uniquement cette entrée. Pour une actualité publiée, réactive son relais si Discord est activé ; aucun renvoi après `DELIVERED` ou `EXPIRED`.

Activer le relais ne reprend plus les actualités `DISABLED` existantes : seuls les éléments `PENDING` sont traités automatiquement. Pour un test de bout en bout, vérifier le salon effectif du bot, activer le relais local puis demander le retry d’une seule actualité récente. Vérifier `DELIVERED`, `news.discord_message_id` et le message réel. Refaire le retry doit conserver le même message. Ne pas modifier la destination de production pour ce test.

La confirmation Rabbit échoue si la persistence échoue, au lieu d’acquitter une livraison non enregistrée. Les confirmations invalides sont rejetées sans boucle. Le bot sérialise les créations et réutilise son registre SQLite durable après un retry ; une interruption exactement entre l’envoi Discord et l’écriture SQLite reste une fenêtre de doublon possible. Ne pas exécuter plusieurs instances partageant la même destination sans mécanisme de coordination supplémentaire.
