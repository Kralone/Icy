# Cloisonnement réseau de production

Cette opération est volontairement séparée des montées de version. Elle conserve
les images, volumes, variables et commandes actuels, et change uniquement les
publications de ports et l'appartenance aux réseaux Docker.

La surcharge exige Docker Compose **2.24.4 ou supérieur**, car elle emploie le
tag `!override` pour remplacer entièrement les listes. La production auditée
utilise Compose 2.33.1. Voir la documentation Docker sur la
[fusion des fichiers Compose](https://docs.docker.com/reference/compose-file/merge/)
et les [réseaux Compose](https://docs.docker.com/reference/compose-file/networks/).

## Résultat attendu

```mermaid
flowchart LR
    Internet((Internet)) -->|80/443| Front[Frontend Nginx]
    Admin[Administrateur par SSH] -.->|tunnel 127.0.0.1:15672| MQ[RabbitMQ]
    Admin -.->|tunnel 127.0.0.1:8200| Vault[Vault]

    subgraph Internal[iceforge_internal — internal: true]
      Front --> Backend[Backend]
      Front --> Images[Serveur d'images]
      Backend --> DB[(PostgreSQL)]
      Backend --> MQ
      Backend --> Vault
      Bot[Bot Discord] --> Backend
      Bot --> MQ
      Bot --> Vault
    end
```

| Service | Publication après changement | Réseaux |
|---|---|---|
| frontend | `0.0.0.0:80/443` | `internal`, `external` |
| RabbitMQ Management | `127.0.0.1:15672` | `internal` |
| Vault | `127.0.0.1:8200` | `internal` |
| backend, bot, PostgreSQL, AMQP, images | aucune | `internal` |

Le binding localhost permet encore un tunnel SSH d'administration, sans rendre
l'API Vault ni RabbitMQ Management joignables depuis Internet. Docker rappelle
qu'un port publié sans adresse d'hôte est lié à toutes les interfaces et peut
être exposé publiquement : [syntaxe des ports](https://docs.docker.com/reference/compose-file/services/#ports).

## Préflight sans modification

1. Confirmer que les sauvegardes PostgreSQL, RabbitMQ et Vault sont intègres et
   présentes hors de l'hôte.
2. Confirmer que tous les services sont `running`, avec les compteurs de
   redémarrage relevés.
3. Copier la surcharge et `verify.sh` dans un répertoire protégé du serveur.
4. Valider le modèle résolu sans l'afficher :

```bash
bash verify.sh -- \
  --project-name iceforge \
  --env-file /root/iceforge/.env \
  -f /root/iceforge/docker-compose.yml \
  -f /root/iceforge/docker-compose.vault.yml \
  -f /root/iceforge/ops/network-hardening/docker-compose.network-hardening.yml
```

`verify.sh` garde le JSON Compose résolu uniquement en mémoire, car il contient
les valeurs interpolées de l'environnement.

## Déploiement par vagues

Toutes les commandes doivent conserver exactement le même projet, le même
fichier d'environnement et les trois mêmes fichiers Compose, dans le même ordre.
Utiliser `docker compose up -d --no-deps --no-build --pull never` afin de refuser
tout build, téléchargement ou changement d'image implicite.

1. Recréer `vault`, l'unseal avec la clé de production, puis vérifier AppRole et
   les lectures KV du backend et du bot. Cette première vague garantit que Vault
   a rejoint `internal` avant que les applications quittent `external`.
2. Recréer `frontend`, `backend` et `icy-images`, puis vérifier la page publique,
   le proxy API et les images.
3. Recréer `bot`, puis vérifier sa connexion Discord, RabbitMQ, Vault et backend.
4. Recréer `db`, puis vérifier PostgreSQL et le backend.
5. Recréer `rabbitmq`, puis vérifier que le volume anonyme est conservé, ainsi
   que ses files, consommateurs et connexions.

Après chaque vague, arrêter immédiatement en cas de service non sain, de compteur
de redémarrage croissant, de réponse HTTP incorrecte ou de perte de connectivité
interne.

## Validation

- depuis Internet, seuls 22, 80 et 443 doivent répondre ;
- depuis l'hôte, `127.0.0.1:8200` et `127.0.0.1:15672` doivent répondre ;
- aucune publication Docker ne doit subsister pour 5432, 5672, 8080, 8081 ou
  8090 ;
- frontend → backend/images, backend/bot → Vault/RabbitMQ et backend → PostgreSQL
  doivent fonctionner sur `iceforge_internal` ;
- les compteurs de redémarrage doivent se stabiliser.

Le port 111 de l'hôte et le durcissement SSH restent des opérations séparées :
ils ne sont pas gérés par cette surcharge Docker.

## Rollback

Le retour arrière consiste à relancer les mêmes services avec seulement les deux
fichiers Compose historiques, donc sans la surcharge. Aucun volume n'est supprimé
et aucune commande `down` n'est utilisée.

Procéder dans l'ordre inverse (`rabbitmq`, `db`, `bot`, vague HTTP, puis `vault`)
et vérifier chaque service. Pour Vault, refaire l'unseal après la recréation. Le
rollback rétablit temporairement les anciens ports publics ; il ne doit être
utilisé que pour restaurer le service, puis le diagnostic doit reprendre avant
une nouvelle tentative.
