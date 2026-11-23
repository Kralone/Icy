import { SessionActivity, SessionPhase, sessionsPath } from '../../../core/services/mining/mining-session.service';

/**
 * Textes et images propres à chaque activité de fiche (docs/mining-v3/SPEC.md, docs/salvage/SPEC.md).
 * La fiche, ses étapes et son partage sont les mêmes ; seuls la collecte et les mots changent.
 */
export interface ActivityText {
  activity: SessionActivity;
  /** « Fiches de minage » : titre de la liste et lien retour. */
  listTitle: string;
  listIntro: string;
  /** « Session de minage » : pastille du bandeau. */
  sessionLabel: string;
  /** « Nouvelle fiche de minage ». */
  newSheet: string;
  heroImage: string;
  /** Nom d'une marchandise : « minerai », « matériau ». */
  goods: string;
  goodsPlural: string;
  /** « Le minerai remis », « Le matériau remis ». */
  theGoods: string;
  /** Option d'opération qui crée la fiche liée. */
  operationOption: string;
  path: string;
}

export const ACTIVITY_TEXTS: Record<SessionActivity, ActivityText> = {
  MINING: {
    activity: 'MINING',
    listTitle: 'Fiches de minage',
    listIntro: 'Raffinage, ventes et partage d’une session, pour toute l’équipe.',
    sessionLabel: 'Session de minage',
    newSheet: 'Nouvelle fiche de minage',
    heroImage: '/assets/images/home/activities/mining.jpg',
    goods: 'minerai',
    goodsPlural: 'minerais',
    theGoods: 'le minerai',
    operationOption: 'Session de minage',
    path: sessionsPath('MINING')
  },
  SALVAGE: {
    activity: 'SALVAGE',
    listTitle: 'Fiches de salvage',
    listIntro: 'Cargaisons récupérées, raffinage du matériau de construction, ventes et partage d’une session de salvage.',
    sessionLabel: 'Session de salvage',
    newSheet: 'Nouvelle fiche de salvage',
    heroImage: '/assets/images/home/activities/salvage.jpg',
    goods: 'matériau',
    goodsPlural: 'matériaux',
    theGoods: 'le matériau',
    operationOption: 'Session de salvage',
    path: sessionsPath('SALVAGE')
  }
};

export function activityText(activity: SessionActivity | null | undefined): ActivityText {
  return ACTIVITY_TEXTS[activity === 'SALVAGE' ? 'SALVAGE' : 'MINING'];
}

/** Libellé court de chaque étape, pour les cartes de la liste. */
export const PHASE_LABELS: Record<SessionPhase, string> = {
  MINING: 'Minage',
  SALVAGING: 'Récupération',
  REFINING: 'Raffinage',
  HANDOVER: 'Remise du cargo',
  SELLING: 'Vente',
  PAYMENTS: 'Versements',
  DONE: 'Terminée'
};
