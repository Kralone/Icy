# Rate limiting des routes publiques

Le backend limite en mémoire les appels suivants :

| Route | Quota par défaut | Clé |
|---|---:|---|
| `POST /api/auth/login` | 20 échecs / 5 min | adresse client |
| `POST /api/auth/login` | 10 échecs / 5 min | identité normalisée + adresse client |
| `POST /api/auth/refresh` | 60 appels / 5 min | adresse client |
| `POST /api/auth/reset-password` | 10 appels / 15 min | adresse client |
| `POST /api/recruitment` | 5 appels / heure | adresse client |

Les connexions réussies ne consomment aucun quota. L'identité n'est volontairement
pas limitée globalement : une limite globale permettrait à un attaquant distribué de
verrouiller le compte d'une victime. Le compromis est qu'un botnet réparti entre de
nombreuses adresses contourne mieux la protection locale; ce scénario doit être traité
par un WAF ou un limiteur distribué.

Les clés conservées sont des empreintes SHA-256 salées avec un sel aléatoire propre au
processus. Ni pseudo, ni token, ni adresse brute ne sont stockés dans le limiteur ou
ajoutés à ses réponses/logs. La réponse de refus est un `429`, un message générique et
un en-tête `Retry-After`.

## Mémoire et concurrence

Le stockage LRU est plafonné par `ICY_RATE_LIMIT_MAXIMUM_ENTRIES` (20 000 par défaut),
ce qui empêche une croissance mémoire non bornée. Sous un trafic d'adresses toutes
différentes, l'éviction des plus anciennes clés réduit la précision mais ne dépasse pas
la borne mémoire.

Cette implémentation est locale à chaque processus. Avec plusieurs réplicas, chaque
instance possède son propre quota et un redémarrage efface les fenêtres. Avant un
déploiement multi-instance, placer la protection principale dans le reverse proxy/WAF
ou migrer l'état vers Redis avec une opération atomique et une expiration.

## Reverse proxy

Par défaut, `X-Forwarded-For` est ignoré et `request.remoteAddr` est utilisé. En
production, définir `ICY_RATE_LIMIT_TRUSTED_PROXIES` avec les adresses exactes des
reverse proxies (une adresse unique se note par exemple `10.253.40.10/32`). Quand le pair direct est fiable,
la chaîne est parcourue de droite à gauche et s'arrête au premier saut non fiable. Ne
jamais configurer `0.0.0.0/0` ou `::/0`.

Les fichiers Compose attribuent donc une adresse fixe différente au frontend Nginx
dans chaque pile et transmettent uniquement cette adresse en `/32` au backend :

| Pile | Sous-réseau par défaut | Proxy exact |
|---|---|---|
| locale/dev | `10.253.20.0/24` | `10.253.20.10/32` |
| validation | `10.253.30.0/24` | `10.253.30.10/32` |
| production | `10.253.40.0/24` | `10.253.40.10/32` |

Les valeurs peuvent être déplacées avec les variables `ICEFORGE_*_INTERNAL_SUBNET`
et `ICEFORGE_*_FRONTEND_IP` en cas de conflit réseau, mais l'adresse doit rester dans
le sous-réseau correspondant. Ne pas élargir la confiance au sous-réseau entier : un
autre conteneur compromis pourrait alors forger l'en-tête. Nginx remplace par ailleurs
tout `X-Forwarded-For` reçu d'Internet par `$remote_addr`; si un CDN ou load balancer
est ajouté devant Nginx, sa chaîne de confiance doit être configurée explicitement dans
Nginx avant de conserver son adresse client.

Le harness suivant démarre la pile jetable, vérifie l'adresse exacte réellement vue
par Docker, envoie des en-têtes forgés à travers Nginx et exige un `429` au onzième
échec sans toucher à la base :

```powershell
.\ops\testing\verify-rate-limit-proxy.ps1
```

Toutes les valeurs sont configurables via les variables `ICY_RATE_LIMIT_*` déclarées
dans `application.yml`.
