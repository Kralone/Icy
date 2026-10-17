# Déverrouiller Vault

## Incident du 17 octobre 2026

Le VPS a redémarré vers 06 h 27, heure de Paris. Vault 1.17.6 a redémarré vers
06 h 28 et est resté scellé (`initialized=true`, `sealed=true`, seuil Shamir 1/1).
L’origine du redémarrage du VPS n’a pas été établie.

Le backend ne pouvait plus s’authentifier par AppRole : `Vault AppRole login failed:
HTTP 503`, puis `Vault bootstrap failed`. Le bot échouait également sur HTTP 503.
Les deux conteneurs redémarraient en boucle ; l’accueil statique répondait 200,
mais `/api/front/members` répondait 502. La mémoire n’était pas saturée.

La clé unseal était toujours conservée sur le VPS dans
`/root/iceforge/.secrets/vault/prod-init.json`, propriétaire root, mode 0600.
Elle a été transmise directement à l’API locale de Vault sans affichage ni copie
locale. Après déverrouillage et relance du backend et du bot, les deux services
étaient `healthy`, sans nouveau redémarrage, et l’API publique répondait 200
vers 18 h 48, heure de Paris. Aucune image, configuration ou migration n’a été modifiée.

## Préparation

Depuis `C:\Users\floga\IdeaProjects\IceForge`, les scripts Windows utilisent
`iceforge-ops@82.29.170.11`, la clé SSH `~/.ssh/iceforge_ops_ed25519` et `sudo -n`.
Ils ne demandent pas de terminal distant PTY et fonctionnent avec une clé SSH `restrict`.
Le script serveur doit être installé une fois ; il utilise Python 3, Docker et le
`wget` présent dans le conteneur Vault. Il ne dépend pas du token root de Vault.

```powershell
scp .\ops\production\vault\vault-recovery.py iceforge-ops@82.29.170.11:/home/iceforge-ops/vault-recovery.py
ssh -T iceforge-ops@82.29.170.11 "sudo -n install -o root -g root -m 0750 /home/iceforge-ops/vault-recovery.py /root/iceforge/ops/production/vault/vault-recovery.py && rm /home/iceforge-ops/vault-recovery.py"
```

Si la clé SSH demande sa passphrase et que l’agent est arrêté, lancer
`Start-Service ssh-agent` dans PowerShell administrateur, puis
`ssh-add "$env:USERPROFILE\.ssh\iceforge_ops_ed25519"` dans le terminal habituel.
Un refus SSH lié à une date d’expiration se traite avec
`ops/production/renew-ops-ssh-access.ps1` ; ce renouvellement ne déverrouille pas Vault.

## Sauvegarder la clé

La clé unseal n’est pas un mot de passe de connexion : elle est distincte du token
root Vault, de la passphrase SSH et de la clé de chiffrement age des sauvegardes.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\ops\production\vault\show-unseal-key-window.ps1
```

Cette commande ouvre une fenêtre PowerShell visible séparée. Seule la première
part de `unseal_keys_b64` est affichée ; le déploiement observé est en 1/1.
Le fichier ouvert doit être régulier, appartenir à root et être en mode 0600 ;
les liens symboliques sont refusés. Le token root et les autres secrets du fichier
ne sont pas affichés. Aucun fichier de clé ni transcription n’est créé par ce script.

Conserver cette clé dans un gestionnaire de mots de passe, avec une copie de reprise
sécurisée indépendante du VPS. Ne pas la coller dans un chat, un ticket, le dépôt Git
ou une transcription de terminal. Fermer la fenêtre après sauvegarde. En cas de
changement du seuil Shamir, organiser la conservation de toutes les parts nécessaires.

## Déverrouiller après un redémarrage

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\ops\production\vault\unseal-from-windows.ps1
```

Le script consulte d’abord l’état de Vault. S’il est déjà déverrouillé, il s’arrête
sans demander la clé. Sinon, il demande une part de clé avec `Read-Host -AsSecureString`.
La valeur traverse l’entrée standard chiffrée de SSH, puis celle de `docker exec` et
du client HTTP. Elle n’apparaît pas dans les arguments des processus, dans l’historique
des commandes ou dans un fichier temporaire. Seuls les champs d’état sélectionnés
de Vault sont renvoyés au terminal.

`VAULT-UNSEAL=OK` confirme que Vault est déverrouillé. Si le seuil exige plusieurs
parts, la progression est indiquée ; relancer avec une autre part. Le script ne
lit pas automatiquement la clé sauvegardée, n’initialise pas Vault, ne modifie aucun
secret et ne redémarre aucun service.

Les paramètres `-Server`, `-SshUser` et `-IdentityFile` permettent de changer l’accès SSH.

## Vérifier les applications

Le backend et le bot réessaient automatiquement leur démarrage, avec un délai
pouvant atteindre une minute. Contrôler les conteneurs et l’API :

```powershell
ssh -T iceforge-ops@82.29.170.11 "sudo -n docker ps --format '{{.Names}} {{.Status}}'"
curl.exe -sS -o NUL -w "%{http_code}\n" https://iceforge.fr/api/front/members
```

Attendre `healthy` pour `iceforge_backend` et `iceforge_bot`, puis HTTP 200.
Si nécessaire, relancer uniquement ces deux applications, sans modifier leurs images :

```powershell
ssh -T iceforge-ops@82.29.170.11 "sudo -n docker restart iceforge_backend iceforge_bot"
```

Si le démarrage échoue encore, consulter les logs récents. Ne jamais lancer
`vault operator init` sur une instance existante, supprimer son volume, désactiver
Vault dans les applications ou modifier les AppRoles pour contourner un scellement.
Sans clé accessible ni copie de reprise utilisable, arrêter la procédure et examiner
les sauvegardes chiffrées existantes ; une nouvelle initialisation ne récupère pas les secrets.

## Validation des scripts

Le programme serveur a été installé le 17 octobre 2026 avec contrôle SHA-256 et
testé en lecture seule sur la production (`sealed=false`). Neuf tests hermétiques
vérifient la protection des fichiers, les sorties sans secret, la saisie transmise
sur stdin, les clés 32/33 octets, les erreurs et les seuils multi-parts.
Le harnais PowerShell 5.1 couvre la saisie masquée, l’instance déjà ouverte, la
progression partielle, l’erreur SSH et l’ouverture d’une fenêtre distincte, avec
des données factices. Un vrai Vault local 1.17.6 jetable a validé le cycle
initialisation 2/3, déverrouillage, redémarrage et nouveau déverrouillage.

La [surveillance mail](PRODUCTION-MONITORING.md) peut annoncer directement un
Vault scellé, sans attendre un signalement de joueur.
