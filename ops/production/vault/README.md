# Configuration des secrets applicatifs de production

`configure-production-secrets.sh` configure les deux chemins KV v2 et les deux
AppRoles utilises par IceForge. Il ne redemarre et ne recree aucun service.

Le script doit etre lance directement dans un terminal root sur AlmaLinux :

```bash
cd /root/iceforge
sudo bash ops/production/vault/configure-production-secrets.sh
```

Si le matériel d'initialisation root-only est encore présent sur le serveur, le
token peut être lu sans jamais être affiché ni copié dans le terminal :

```bash
sudo bash ops/production/vault/configure-production-secrets.sh \
  --init-json /root/iceforge/.secrets/vault/prod-init.json
```

Cette option refuse les liens symboliques, un propriétaire autre que `root` et
les permissions de groupe ou publiques.

Le token Vault administrateur et les valeurs sensibles sont lus en saisie
masquee. Une ligne vide conserve la valeur deja presente dans Vault. Le script
ne place jamais ces valeurs dans ses arguments, sa sortie ou un fichier
temporaire. Les mots de passe PostgreSQL et RabbitMQ sont repris depuis le
fichier `.env` actuel : ce programme ne les fait pas tourner, car une rotation
doit aussi modifier les comptes dans les deux services stateful.

Il ecrit :

- `secret/iceforge/prod/backend` ;
- `secret/iceforge/prod/bot` ;
- les politiques de lecture limitees a chacun de ces chemins ;
- les AppRoles `iceforge-backend-prod` et `iceforge-bot-prod` ;
- `.secrets/vault/compose.prod.env`, en mode `0600`, apres verification reelle
  des deux nouveaux identifiants AppRole.

L'ancien fichier Compose est sauvegarde avant remplacement. Apres validation et
remplacement atomique, le Secret ID precedent de chaque AppRole est detruit s'il
peut etre retrouve depuis le fichier Compose existant ou l'etat des accessors.

Vault doit etre initialise et descelle. Ne jamais transmettre dans un chat le
token administrateur, une cle d'unseal, une cle privee `age`, un token Discord
ou une cle API.

Depuis Windows, la saisie distante peut être lancée avec :

```powershell
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File `
  .\ops\production\vault\configure-from-windows.ps1 `
  -Server 82.29.170.11 `
  -IdentityFile "$env:USERPROFILE\.ssh\iceforge_ops_ed25519"
```

Les valeurs secrètes sont saisies de façon masquée dans PowerShell puis envoyées
uniquement sur l'entrée standard chiffrée de SSH. Elles ne transitent ni dans les
arguments SSH, ni dans l'historique PowerShell, ni dans un fichier temporaire.
Ce mode fonctionne avec une clé `authorized_keys` marquée `restrict` et ne
nécessite donc pas d'autoriser un PTY distant.

Ajouter `-GenerateLocalSecrets` génère localement, sans les afficher ni les
écrire sur disque, un nouveau secret JWT, une nouvelle clé backend/bot et une
nouvelle paire VAPID P-256. Les tokens Discord, OpenAI et UEX doivent être créés
chez leurs fournisseurs puis collés dans les invites masquées ; une saisie vide
conserve la valeur déjà présente dans Vault.
