import { TutorialDefinition } from './tutorial.model';

const tuto = (name: string) => `[data-tuto="${name}"]`;

export const TUTORIALS: ReadonlyArray<TutorialDefinition> = [
  {
    id: 'operation-page',
    version: 1,
    title: 'Fiche d’opération',
    matches: path => /^\/icy\/operations\/(?!new$)[^/]+$/.test(path),
    steps: [
      {
        target: tuto('operation-hero'),
        title: 'Fiche d’opération',
        text: 'Le bandeau donne le type, la date, les horaires, le point de rendez-vous et le nombre de participants confirmés.'
      },
      {
        target: tuto('operation-sections'),
        title: 'Sections de la fiche',
        text: 'Ces boutons mènent directement à chaque partie de la fiche. La fiche de minage et la gestion de l’opération apparaissent ici quand elles vous concernent.'
      },
      {
        target: '#presence',
        title: 'Votre réponse',
        text: 'Indiquez si vous serez présent. Il faut être « Présent » pour rejoindre un groupe ou proposer un vaisseau.'
      },
      {
        target: '#affectation',
        title: 'Mon affectation',
        text: 'Votre groupe, son responsable et votre poste à bord. Une demande en attente de validation apparaît aussi ici.'
      },
      {
        target: '#organisation',
        title: 'Organisation',
        text: 'L’organigramme des groupes et des équipages. Selon le mode du groupe, vous le rejoignez directement ou vous envoyez une demande au responsable.'
      },
      {
        target: '#coordination',
        title: 'Coordination',
        text: 'Réservé aux organisateurs et responsables : demandes à valider et participants sans affectation.'
      },
      {
        target: '#flotte',
        title: 'Flotte',
        text: 'Les vaisseaux prévus et ceux proposés par les participants. Choisissez un vaisseau de votre hangar pour le proposer : cela ne vous affecte à aucun groupe.'
      }
    ]
  },
  {
    id: 'hangar',
    version: 1,
    title: 'Mon hangar',
    matches: path => path === '/icy/hangar',
    steps: [
      {
        title: 'Mon hangar',
        text: 'Votre hangar liste les vaisseaux que vous possédez. Il sert à proposer un vaisseau dans une opération et à composer la flotte de l’organisation.'
      },
      {
        target: tuto('hangar-add'),
        title: 'Ajouter un vaisseau',
        text: 'Choisissez un modèle du catalogue et son type de possession : RSI, achat en jeu, récompense en jeu ou loaner.'
      },
      {
        target: tuto('hangar-filters'),
        title: 'Rechercher',
        text: 'Filtrez par nom ou par constructeur.'
      },
      {
        target: tuto('hangar-ship'),
        title: 'Fiche du vaisseau',
        text: 'Cliquez sur une carte pour ouvrir le détail du vaisseau. Au survol, les boutons en haut à gauche modifient le type de possession ou retirent le vaisseau. Le badge en bas indique le type de possession.'
      }
    ]
  },
  {
    id: 'scwe',
    version: 1,
    title: 'SC World Events',
    matches: path => path === '/icy/scwe',
    steps: [
      {
        target: tuto('scwe-header'),
        title: 'SC World Events',
        text: 'Cette page suit votre progression sur les événements du jeu. Les données se mettent à jour en direct.'
      },
      {
        target: tuto('scwe-tabs'),
        title: 'Trois vues',
        text: 'En cours : vos événements actifs et votre saisie. Classement : le total de chaque joueur inscrit. Historique : les événements terminés.'
      },
      {
        target: tuto('scwe-progress-bar'),
        title: 'Total et paliers',
        text: 'La barre montre votre total de points. Chaque repère est un palier : cliquez dessus pour voir la récompense associée.'
      },
      {
        target: tuto('scwe-progress-editor'),
        title: 'Saisir sa progression',
        text: 'Renseignez vos points par catégorie avec − et + ou en tapant la valeur, puis cliquez sur « Enregistrer ». Votre premier enregistrement vous inscrit au classement.'
      }
    ]
  }
];

export function findTutorialForPath(path: string): TutorialDefinition | null {
  return TUTORIALS.find(tutorial => tutorial.matches(path)) ?? null;
}
