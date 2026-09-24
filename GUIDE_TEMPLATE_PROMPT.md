# Prompt de rédaction d’un guide IceForge

Ce document est un prompt prêt à donner à un autre GPT pour produire un guide compatible avec le système de guides d’IceForge.

## Demande

Rédige un guide complet pour le site IceForge sur le sujet suivant :

```text
[SUJET DU GUIDE]
```

Avant de commencer, identifie précisément le sujet. S’il existe plusieurs éléments portant le même nom, explique les interprétations possibles et demande laquelle doit être traitée. Cette vérification est obligatoire pour les noms ambigus comme « Storm Breaker ».

## Recherche obligatoire

Effectue une recherche extrêmement approfondie avant de rédiger ou de corriger le guide. Ne te limite jamais à une seule source.

- documentation officielle de Star Citizen et de CIG ;
- notes de mise à jour de toutes les versions récentes ;
- Star Citizen Tools, Star Citizen Wiki et autres bases de données reconnues ;
- guides écrits récents, en français et en anglais ;
- forums officiels, Reddit et discussions communautaires publiques ;
- vidéos YouTube récentes : tutoriels, démonstrations, comptes rendus de joueurs et commentaires ;
- discussions Discord publiques lorsqu’elles sont accessibles.

Compare plusieurs sources indépendantes entre elles. Pour chaque information importante :

- indique la source utilisée ;
- ajoute le lien direct vers la source ;
- précise la date de publication ou de vérification ;
- précise la version du jeu utilisée ;
- signale les contradictions ;
- distingue les faits confirmés, les observations en jeu, les informations discutées par la communauté, les informations anciennes et les hypothèses ;
- indique ce qui peut changer lors d’un prochain patch.

Utilise les vidéos et les forums pour repérer les mécaniques réelles et les problèmes rencontrés par les joueurs, mais ne transforme pas automatiquement une affirmation communautaire en vérité officielle. Si les sources se contredisent, conserve la contradiction dans le guide et explique quelle information semble la plus fiable. N’invente aucune donnée. Si une information n’est pas confirmée, écris-le clairement ou retire-la.

## Vérification corrective

Si un guide ou un brouillon est fourni, vérifie particulièrement :

- la version du jeu et l’Alpha mentionnées ;
- les lieux, étapes et conditions d’accès ;
- les équipements réellement nécessaires ;
- les mécaniques de mission, puzzles, terminaux et combats ;
- les points faibles, récompenses et quantités de butin ;
- les chiffres, durées, codes et seuils ;
- les informations présentées comme officielles alors qu’elles viennent de la communauté.

Ne présente pas une stratégie IceForge comme une mécanique obligatoire du jeu. Les rôles d’équipe et conseils d’organisation doivent être présentés comme des recommandations.

## Informations générales

Prépare les métadonnées suivantes :

- **Slug** : minuscules, mots séparés par des tirets ;
- **Titre** ;
- **Sous-titre** ;
- **Résumé** ;
- **Version du jeu** ;
- **Difficulté** : débutant, confirmé ou expert ;
- **Temps de lecture estimé** ;
- **Tags** ;
- **Statut** : disponible, en rédaction ou à venir ;
- **Glossaire** des termes et abréviations importants.

## Structure du guide

Le guide doit être organisé en grandes sections. Pour chaque section, fournis :

- un identifiant technique en minuscules avec des tirets ;
- un titre clair ;
- un résumé court ;
- une ou plusieurs sous-sections ;
- des paragraphes explicatifs ;
- des listes à puces lorsque cela facilite la lecture ;
- des encadrés de conseil, d’information ou de danger ;
- une image pertinente uniquement si sa source est fiable.

Adapte les sections au sujet. Selon le cas, traite notamment :

- présentation et rôle ;
- prérequis ;
- équipement recommandé ;
- lieux et conditions d’utilisation ;
- déroulement étape par étape ;
- fonctionnement détaillé ;
- stratégies débutant et avancée ;
- risques et erreurs fréquentes ;
- coûts, récompenses ou rentabilité ;
- coopération et répartition des rôles ;
- variantes et cas particuliers ;
- état actuel et changements récents.

## Style rédactionnel

- Écris en français.
- Utilise un ton clair, pratique et pédagogique.
- Explique le pourquoi avant de donner une procédure.
- Donne des étapes concrètes et vérifiables.
- Utilise les noms exacts du jeu.
- Ne présente jamais une donnée absente comme une valeur réelle.
- Ne déduis pas une capacité, une rentabilité ou une compatibilité sans source.
- Distingue toujours les informations valables pour la version actuelle des informations historiques.

## Encadrés

Les encadrés utilisent l’un de ces tons :

```text
live     Information positive ou conseil utile
writing  Contenu encore en cours de rédaction
soon     Information ou fonctionnalité à venir
alert    Danger, erreur fréquente ou avertissement
```

Exemple :

```json
{
  "title": "Attention",
  "text": "Ne commencez pas cette étape sans vérifier les prérequis.",
  "tone": "alert"
}
```

## Liens internes IceForge

Quand un élément existe dans la base du site, utilise ces formats :

```text
[[db:ship:Prospector|Prospector]]
[[db:item:Multi-tool|Multi-tool]]
[[db:ship:Argo Astronautics ATLS GEO|ATLS GEO]]
```

N’invente pas de lien interne si le nom exact dans la base n’est pas vérifié.

## Format JSON final

À la fin, retourne un JSON valide directement compatible avec le champ « Contenu JSON du guide » de l’administration IceForge. Le JSON doit contenir un tableau `sections`.

```json
{
  "sections": [
    {
      "id": "identifiant-section",
      "title": "Titre de la section",
      "summary": "Résumé court de la section.",
      "subsections": [
        {
          "title": "Titre de la sous-section",
          "paragraphs": [
            "Premier paragraphe.",
            "Deuxième paragraphe."
          ],
          "bullets": [
            "**Point important :** explication.",
            "Autre point vérifié."
          ],
          "callouts": [
            {
              "title": "Conseil",
              "text": "Information utile pour le lecteur.",
              "tone": "live"
            }
          ]
        }
      ],
      "callout": {
        "title": "Règle de sécurité",
        "text": "Avertissement lié à cette section.",
        "tone": "alert"
      },
      "imageUrl": "https://exemple.com/image.jpg"
    }
  ]
}
```

Le JSON doit être strictement valide : pas de commentaire, pas de virgule finale et toutes les chaînes doivent être correctement échappées.

## Résultat attendu

Retourne les éléments dans cet ordre :

1. le guide complet rédigé ;
2. les métadonnées ;
3. le glossaire ;
4. les images proposées et leurs sources ;
5. les sources consultées, avec leurs liens directs, leur date et la version du jeu ;
6. les contradictions ou points incertains ;
7. les éléments à revérifier après un prochain patch ;
8. le JSON final compatible avec IceForge.

## Consigne spécifique pour Storm Breaker

Si le sujet demandé est « Storm Breaker », commence par déterminer s’il s’agit d’un vaisseau, d’une arme, d’une mission, d’un événement, d’un équipement ou d’un autre élément de Star Citizen. Ne rédige pas le guide tant que cette identification n’est pas confirmée.
