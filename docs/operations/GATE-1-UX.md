# Gate 1 — UX et parcours

## Périmètre

Le parcours de création d’une opération part du panneau d’administration. La gestion des événements conserve uniquement la création et la gestion des événements ; elle ne propose plus de conversion visible vers une opération.

## Parcours validé

1. Un administrateur ouvre `Admin > Nouvelle opération`.
2. L’écran `/icy/operations/new` présente le titre, le type, la description, les dates et une action `Créer et ouvrir l’éditeur`.
3. L’action reste désactivée tant que les champs obligatoires ne sont pas renseignés.
4. La création produit un brouillon et ouvre directement l’éditeur d’opération.
5. L’éditeur expose ensuite les objectifs, la permission de proposer des vaisseaux, les groupes et la publication.

## Écran de référence

Capture CUA réalisée le 11/10/2026 à 14:05 (Docker `127.0.0.1:18088`, viewport 1280×720, session `validation_admin`) :

- URL : `http://127.0.0.1:18088/icy/operations/new`
- Titre visible : `Créer une opération`
- Aide visible : `L’opération sera créée comme brouillon et ouvrira directement son éditeur.`
- Contrôles accessibles : Titre, Type, Description, Début, Fin, `Créer et ouvrir l’éditeur`.
- État initial vérifié : l’action est désactivée sans données obligatoires.

La même session a vérifié `http://127.0.0.1:18088/icy/admin/events` après reconstruction Docker : la zone de création d’événement ne présente plus de bouton `Transformer en opération`.

## Règles d’interface

- Le bouton de création d’opération est porté par le panneau admin afin d’éviter deux sources de vérité.
- Les états désactivés restent lisibles et expliquent implicitement la complétude attendue par les libellés des champs.
- Les champs et actions utilisent les couleurs IceForge existantes et conservent la structure responsive du panneau.
- Aucune donnée absente n’est affichée comme une valeur réelle.

## Limites à lever aux gates suivants

- Gate 1 ne prononce pas la conformité métier complète de la création ni de la publication.
- La capture mobile dédiée reste à produire avant le verdict responsive final.
- Les gates 2 à 7 doivent fournir leurs propres preuves indépendantes.
