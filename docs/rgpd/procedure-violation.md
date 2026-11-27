# Procédure en cas de violation de données (RGPD art. 33 et 34)

Une violation, c'est une perte de confidentialité, d'intégrité ou de disponibilité de données personnelles :
serveur compromis, fuite de la base ou d'une sauvegarde, compte admin volé, suppression accidentelle sans
sauvegarde.

## 1. Contenir (tout de suite)

- Couper l'accès en cause : changer les secrets (JWT, base, Vault, webhook Discord, mot de passe Hostinger).
- Révoquer les sessions : `DELETE FROM core.refresh_tokens;` (les jetons d'accès expirent en 15 min).
- Garder les traces : journaux Docker, journaux Hostinger, heure de détection.

## 2. Évaluer (dans les 24 h)

Quelles données, combien de personnes, quelles conséquences possibles. Les mots de passe sont hachés (bcrypt) et
les sauvegardes chiffrées : une fuite de sauvegarde chiffrée sans la clé présente un risque faible.

## 3. Notifier la CNIL (dans les 72 h après la découverte)

Sauf si la violation n'entraîne vraisemblablement aucun risque pour les personnes. Téléservice :
https://notifications.cnil.fr/notifications/index. Si des informations manquent, notifier quand même puis compléter.

## 4. Informer les membres

Si le risque est élevé (par exemple données lisibles et réutilisables), prévenir les membres sans tarder, via
Discord et sur le site : ce qui s'est passé, les conséquences, ce qui a été fait, ce qu'ils peuvent faire.

## 5. Documenter

Toute violation, même non notifiée, est notée dans un journal des violations gardé hors de ce dépôt : date, faits,
données et personnes concernées, mesures prises, décision de notifier ou non et pourquoi.

## 6. Corriger

Corriger la cause, vérifier les sauvegardes, puis relire `docs/PRODUCTION-HOST-HARDENING.md` et
`docs/SECURITY-AUDIT.md`.
