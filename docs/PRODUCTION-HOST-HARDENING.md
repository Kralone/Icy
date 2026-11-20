# Durcissement de l'hôte de production

Ce document couvre l'hôte AlmaLinux lui-même : SSH, fail2ban, pare-feu
d'entrée et mises à jour. Le cloisonnement des ports Docker est décrit dans
[`PRODUCTION-NETWORK-HARDENING.md`](PRODUCTION-NETWORK-HARDENING.md).

## État au 20 novembre 2026

| Élément | État | Retour arrière |
|---|---|---|
| SSH | clé uniquement, root par clé seulement, X11 et GSSAPI coupés, `MaxAuthTries 3`, `LoginGraceTime 30` | supprimer `/etc/ssh/sshd_config.d/01-iceforge-hardening.conf`, `sshd -t`, `systemctl reload sshd` |
| Clé root | `iceforge-admin` ajoutée, clé Hostinger conservée | `/root/authorized_keys.bak-20261120` |
| fail2ban | jail `sshd`, 5 échecs en 10 min, ban 1 h doublé à chaque récidive jusqu'à 4 semaines, historique 30 jours | `systemctl disable --now fail2ban`, puis `dnf remove fail2ban-server fail2ban-systemd` |
| Système | AlmaLinux 9 à jour, noyau `5.14.0-741.22.1.el9_9`, Docker 29.10.0, Compose 5.8.0 | snapshot hPanel du jour |
| Pare-feu d'entrée | aucun (à appliquer, voir ci-dessous) | — |
| Mises à jour automatiques | aucune (à appliquer, voir ci-dessous) | — |
| SELinux | désactivé | chantier séparé |

Le fichier `01-iceforge-hardening.conf` est lu avant `50-cloud-init.conf` :
la première valeur lue l'emporte, ce qui neutralise le
`PasswordAuthentication yes` posé par cloud-init sans modifier ce fichier.
Les blocs `Match` d'`iceforge-ops` et `iceforge-db-admin` sont inchangés.

fail2ban est installé sans le paquet complet `fail2ban`, qui dépend de
firewalld. Il utilise l'action `nftables` dans sa propre table. L'adresse
d'administration est en liste blanche dans `/etc/fail2ban/jail.local`.

Pour se connecter en root, la clé `iceforge_admin_ed25519` doit être chargée
dans l'agent SSH Windows. En cas de perte, la console Hostinger reste le
dernier recours.

## Pare-feu d'entrée

`ops/production/system/host-firewall.nft` crée une table dédiée
`inet iceforge_host` avec une politique `drop` sur le hook `input`. Elle
autorise la boucle locale, les connexions établies, les ponts Docker, l'ICMP
nécessaire, le DHCP client et les ports 22, 80 et 443.

La table ne touche ni aux règles Docker ni à celles de fail2ban : le trafic
publié vers les conteneurs passe par `forward` et reste géré par Docker.
firewalld n'est pas utilisé, et le service `nftables` du système non plus,
car son arrêt vide tout le jeu de règles, y compris celles de Docker.

```bash
sudo /root/iceforge/ops/production/system/apply-host-firewall.sh --check
sudo /root/iceforge/ops/production/system/apply-host-firewall.sh --apply
# ouvrir une NOUVELLE session SSH, vérifier le site, puis dans les 180 s :
sudo /root/iceforge/ops/production/system/apply-host-firewall.sh --confirm
```

`--apply` programme le retrait des règles 180 s plus tard, avant même de les
charger. Si l'accès SSH est perdu, il suffit d'attendre. `--confirm` installe
le service `iceforge-host-firewall.service`, qui recharge la table au
démarrage. `--remove` retire tout.

Validation : depuis l'extérieur, seuls 22, 80 et 443 répondent ; le site et
`/api/front/members` répondent 200 ; backend et bot restent sains ;
`fail2ban-client status sshd` fonctionne.

## Mises à jour de sécurité automatiques

`ops/production/system/configure-dnf-automatic.sh --apply` installe
`dnf-automatic` et active son timer quotidien avec :

- `upgrade_type = security` : seuls les avis de sécurité sont appliqués ;
- Docker et containerd exclus, car leur mise à jour redémarre les conteneurs
  et rescelle Vault ;
- `reboot = never` : un nouveau noyau est installé mais ne sera chargé qu'au
  prochain redémarrage planifié avec `update-almalinux9.sh`.

Le résultat est visible avec `journalctl -u dnf-automatic`. `--remove`
désactive le timer et restaure la configuration d'origine.
