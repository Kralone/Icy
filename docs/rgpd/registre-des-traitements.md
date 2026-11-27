# Registre des traitements (RGPD art. 30)

Responsable de traitement : l'éditeur du site (voir `/mentions-legales`), personne physique, non professionnel.
Contact : iceforgeindustries@gmail.com. Pas de DPO (non obligatoire).

| Traitement | Finalité | Personnes | Données | Base légale | Durée | Destinataires |
|---|---|---|---|---|---|---|
| Comptes membres | Accès à l'espace membre, organisation de la guilde | Membres | Pseudo, identifiant Discord, mot de passe (empreinte bcrypt), avatar, description, rôles, statut, dernière connexion | Intérêt légitime | Tant que membre ; anonymisé 2 ans après le départ | Directeurs, officiers |
| Activité de guilde | Flotte, objectifs, événements, sessions, banque | Membres | Participations, vaisseaux, gains et dépenses | Intérêt légitime | Comme le compte ; l'historique partagé est gardé sous forme anonyme | Membres selon les pages |
| Candidatures | Recrutement | Candidats | Pseudo, identifiant Discord, réponses | Mesures précontractuelles / intérêt légitime | 6 mois après la décision | Directeurs, officiers |
| Suivi d'activité et rappels | Relancer les membres inactifs | Membres | Dates d'activité, notes de suivi, messages privés envoyés par le bot | Intérêt légitime | 1 an | Directeurs, officiers |
| Avertissements et sanctions | Modération | Membres | Motif, date, auteur | Intérêt légitime | Comme le compte | Directeurs, officiers |
| Notifications du navigateur | Prévenir des événements | Membres qui les activent | Abonnement push, navigateur | Consentement | Jusqu'à désactivation ou départ | Service push du navigateur |
| Contact par email | Répondre aux messages et demandes RGPD | Toute personne | Adresse, contenu | Intérêt légitime ; obligation légale (demandes RGPD) | 12 mois après le dernier échange ; annonce Discord 3 mois | Éditeur ; expéditeur et objet dans un salon Discord privé |
| Sécurité | Connexion, journaux, sauvegardes | Visiteurs, membres | Adresse IP, journaux techniques, jetons de session | Intérêt légitime | Journaux : rotation Docker ; jetons : 7 jours ; sauvegardes : 6 mois | Hébergeur |

## Sous-traitants et transferts

| Prestataire | Rôle | Localisation | Garantie |
|---|---|---|---|
| Hostinger International Ltd | Hébergement (serveur à Paris) | UE ; sous-traitants possibles hors UE (support) | DPA annexé aux CGU, clauses contractuelles types |
| Discord (Discord Netherlands BV) | Connexion Discord, bot, annonces | UE / États-Unis | Responsable distinct ; Discord Inc. adhère au Data Privacy Framework |
| Google (Google Ireland Ltd) | Boîte Gmail de contact, relais Apps Script | UE / États-Unis | Responsable distinct ; Google LLC adhère au Data Privacy Framework |
| Service push du navigateur | Acheminement des notifications | Variable | Aucune garantie spécifique ; seulement si le membre active les notifications |

## Mesures de sécurité

HTTPS, mots de passe hachés (bcrypt), jeton d'accès de 15 min et rafraîchissement de 7 jours révoqué à la
déconnexion, mot de passe temporaire valable 72 h et à changer à la première connexion, accès admin par rôle,
sauvegardes chiffrées (age), rotation des journaux Docker, purge automatique quotidienne (`DataRetentionService`).
