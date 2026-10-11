# Matrice de conformité — Opérations V1

État initial du Gate 0, établi sur `main` au commit `12024a3`. `NON AUDITÉ` signifie qu’aucune preuve reproductible n’est disponible. CRT-01/CRT-02 sont partiellement réalisés : le bouton et l’endpoint existent, la conversion est transactionnelle et les effets de création sont différés après commit ; captures, rollback d’intégration et parcours complet restent à valider.

| Domaine | Exigences atomiques | État initial | Écart principal |
|---|---|---|---|
| Navigation | NAV-01..05 | PARTIEL / NON AUDITÉ | Routes opération présentes, mais clic, rechargement profond et mobile non rejoués. |
| Création | CRT-01..03 | FAIL | Formulaire événement commun, bouton de conversion et conservation complète absents côté UI. |
| Création | CRT-04..05 | ABSENT | Brouillon persistant et erreur d’autosave non implémentés. |
| Création | CRT-06..09 | PARTIEL / ABSENT | Éditeur et publication existent, objectifs, permissions et aperçu réel manquent. |
| Création | CRT-10 | CONFORME | Date et heure demandées par la création. |
| Interface | UI-01..03 | PARTIEL | Tokens IceForge et page dédiée présents ; preuves visuelles et responsive absentes. |
| Interface | UI-04..08 | PARTIEL / ABSENT | Briefing et groupes présents ; objectifs, membres, statuts et cartes vaisseaux incomplets. |
| Interface | UI-09..11 | NON AUDITÉ | Aucune capture 1440/1280/390 ni audit accessibilité/états. |
| Interface | UI-12 | FAIL | Éditeur simple, sans zones organisationnelles complètes. |
| Interface | UI-13..14 | NON AUDITÉ | Cohérence iconographique et comparaison aux pages existantes non prouvées. |
| Groupes | GRP-01..03 | PARTIEL | Hiérarchie et capacité présentes, limite et règles d’affectation non prouvées. |
| Groupes | GRP-04..10 | PARTIEL / NON AUDITÉ | Capacité parent, unicité, modes, transfert atomique et demandes non couverts de bout en bout. |
| Groupes | GRP-11 | ABSENT | Délégation explicite et portée manquantes. |
| Groupes | GRP-12..15 | PARTIEL / NON AUDITÉ | Visibilité, non-affecté et réorganisation non vérifiés. |
| Vaisseaux | SHP-01..05 | PARTIEL | Ownership et rattachement présents ; permission, statut Présent et distinction propriétaire/pilote à compléter. |
| Vaisseaux | SHP-06..08 | ABSENT / NON AUDITÉ | Besoins, retrait et poste sans seconde affectation manquants. |
| Calendrier | CAL-01..03 | PARTIEL / NON AUDITÉ | Bifurcation opération présente ; colonnes, boutons et statistiques historiques non rejoués. |
| Discord | DSC-01..06 | PARTIEL / NON AUDITÉ | Flux et boutons historiques présents ; embed opération, lien et synchronisation non prouvés. |
| Sécurité | SEC-01..05 | PARTIEL / FAIL | Rôles présents ; délégation, brouillons privés et contrôle de proposition navire incomplets. |
| Sécurité | SEC-06..10 | PARTIEL / NON AUDITÉ | Validation XSS, CORS, logs, erreurs et deep-links non vérifiés. |
| Régression | REG-01..08 | NON AUDITÉ | Aucun parcours complet événements, hangar, auth, mobile et migration ancienne documenté. |

## Détail des identifiants

Les lignes ci-dessus couvrent les 79 identifiants atomiques : NAV-01 à NAV-05, CRT-01 à CRT-10, UI-01 à UI-14, GRP-01 à GRP-15, SHP-01 à SHP-08, CAL-01 à CAL-03, DSC-01 à DSC-06, SEC-01 à SEC-10 et REG-01 à REG-08. Chaque identifiant recevra une preuve, un test ou une décision explicitement référencée avant le passage du gate concerné.

## Règle de passage

Aucun gate ne peut être déclaré PASS avec un écart bloquant, une preuve absente ou un axe indépendant NON VÉRIFIÉ.
