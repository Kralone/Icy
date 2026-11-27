# Images venues d'autres sites

Les images affichées depuis d'autres sites (wiki Star Citizen, RSI, presse) font envoyer l'adresse IP des
visiteurs à ces sites. Elles sont copiées sur le serveur, puis leurs liens sont remplacés.

## Images en base (catalogue, actualités, événements, guides…)

Service `ExternalImageMirrorService`, colonnes listées dans `SOURCES`. Les copies vont dans la banque d'images,
catégorie « Images importées », sous-catégorie = site d'origine, nom `ext-<empreinte du lien>.<ext>`. La table
`media.external_image_mirror` garde la correspondance : une image n'est téléchargée qu'une fois, et la
synchronisation du catalogue reprend la copie locale.

Avec un jeton admin :

```sh
# Liste seulement : rien n'est téléchargé ni modifié
curl -H "Authorization: Bearer $TOKEN" https://iceforge.fr/api/admin/images/external | jq '.byHost, .externalImages'

# Copie au plus 200 nouvelles images, puis remplace les liens de toutes celles déjà copiées
curl -X POST -H "Authorization: Bearer $TOKEN" "https://iceforge.fr/api/admin/images/external/mirror?limit=200"
```

Une image refusée (lien mort, pas une image, plus de 20 Mo) garde son lien d'origine ; l'erreur est notée
dans `last_error`. Seules les adresses publiques en http(s) sont téléchargées.

Chaque nuit à 04:45, `ICEFORGE_IMAGE_MIRROR_MODE` décide : `report` (défaut) journalise la liste, `apply`
copie les nouvelles images (catalogue synchronisé, actualités CIG Watch…), `off` ne fait rien.

## Images écrites dans le code du frontend

```sh
cd icy-angular
node mirror-code-images.mjs           # liste seulement
node mirror-code-images.mjs --apply   # télécharge dans public/assets/images/external/ et remplace les liens
```

`public/assets/images/external/manifest.json` garde la correspondance ; le script est relançable.
À lancer depuis un poste qui accède à Internet, puis committer les images et les fichiers modifiés.
