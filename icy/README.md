# Bot Discord IceForge

## Runtime de référence

- Python 3.11.16
- dépendances directes épinglées dans `requirement.txt`

## Installation locale

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirement.txt
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
