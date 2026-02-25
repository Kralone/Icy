# Vault Local/Prod (AppRole)

Ce setup ajoute un Vault persistant en conteneur, avec le meme mode d'acces pour le backend Java et le bot Python.

## Architecture

- Conteneur Vault: `docker-compose.vault.yml`
- Stockage persistant: volume Docker `vault_data` (raft)
- Auth applicative: `AppRole`
- Secrets par environnement:
  - dev backend: `secret/data/iceforge/dev/backend`
  - dev bot: `secret/data/iceforge/dev/bot`
  - prod backend: `secret/data/iceforge/prod/backend`
  - prod bot: `secret/data/iceforge/prod/bot`

## Cle UEX (backend)

- Cle attendue par le backend: `UEX_API_KEY`
- Emplacement dev: `secret/data/iceforge/dev/backend`
- Emplacement prod: `secret/data/iceforge/prod/backend`

Exemples:
```powershell
vault kv patch secret/iceforge/dev/backend UEX_API_KEY="TON_API_KEY_UEX"
vault kv patch secret/iceforge/prod/backend UEX_API_KEY="TON_API_KEY_UEX"
```

Optionnel (override URL API):
```powershell
vault kv patch secret/iceforge/dev/backend UEX_API_BASE_URL="https://api.uexcorp.uk/2.0"
```

## Variables runtime (backend/bot)

- `VAULT_ENABLED=true`
- `VAULT_ADDR=http://vault:8200` (ou `http://127.0.0.1:8200` en local)
- `VAULT_KV_MOUNT=secret`
- `VAULT_KV_PATH=iceforge/dev/backend` ou `iceforge/dev/bot`
- `VAULT_ROLE_ID=...`
- `VAULT_SECRET_ID=...`
- `VAULT_FAIL_FAST=true`

## Local (dev)

1. Demarrer Vault:
```powershell
.\scripts\vault\start-vault.ps1
```

2. Initialiser Vault + creer AppRoles:
```powershell
.\scripts\vault\init-dev-vault.ps1
```

Fichiers crees:
- `.secrets/vault/dev-init.json` (root token + unseal key)
- `.secrets/vault/backend.dev.env`
- `.secrets/vault/bot.dev.env`

3. Alimenter Vault avec les secrets dev depuis `secrets/local.secrets.env`:
```powershell
.\scripts\vault\seed-dev-vault-from-env.ps1
```

4. Lancer les composants avec leurs env Vault:
- Backend: charger `.secrets/vault/backend.dev.env`
- Bot: charger `.secrets/vault/bot.dev.env`

## Prod

- Lancer le meme conteneur Vault.
- Initialiser AppRole/policies prod:
```powershell
.\scripts\vault\init-prod-vault.ps1
```
- Creer ton fichier `secrets/prod.secrets.env` depuis `secrets/prod.secrets.example.env`, puis pousser les secrets:
```powershell
.\scripts\vault\seed-prod-vault-from-env.ps1 -EnvFile secrets/prod.secrets.env
```
- Injecter les `VAULT_*` de:
  - `.secrets/vault/backend.prod.env` pour le backend
  - `.secrets/vault/bot.prod.env` pour le bot
- Pour Docker Compose (backend + bot en conteneurs), utiliser le fichier genere:
  - `.secrets/vault/compose.prod.env`
  - puis lancer:
```powershell
docker compose --env-file secrets/prod.secrets.env --env-file .secrets/vault/compose.prod.env -f docker-compose.yml -f docker-compose.vault.yml up -d vault db rabbitmq backend bot frontend icy-images
```
- Ne jamais reutiliser role/secret-id dev en prod.
