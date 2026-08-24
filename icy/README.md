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

## Validation sans connexion à Discord

```powershell
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m compileall -q -x "(^|[\\/])\.venv([\\/]|$)" .
```

Lors d'une mise à jour, modifier d'abord `requirement.txt`, régénérer
`requirements.lock` sous Python 3.14, puis exécuter toute la validation avant
de remplacer le verrou existant.
