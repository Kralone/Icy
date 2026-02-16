# Local Vault (SOPS + age)

Objectif: stocker les secrets localement de facon chiffree, sans versionner les valeurs en clair.

## Prerequis

- `sops`
- `age` (commande `age-keygen`)
- `docker compose`

## Initialisation locale

```powershell
.\scripts\secrets\init-local-vault.ps1
```

Ce script:
- cree `.secrets/age/keys.txt` (cle privee locale, non versionnee)
- cree `secrets/local.secrets.env` depuis l'exemple

## Chiffrer les secrets

1. Remplir `secrets/local.secrets.env`
2. Chiffrer:

```powershell
.\scripts\secrets\encrypt-local-secrets.ps1
```

Fichier genere:
- `secrets/local.secrets.sops.yaml` (versionnable)

## Lancer la stack avec secrets dechiffres a la volee

```powershell
.\scripts\secrets\compose-up.ps1
```

Ce script:
- dechiffre vers `.secrets/runtime/local.secrets.env`
- lance `docker compose --env-file .secrets/runtime/local.secrets.env up -d`
