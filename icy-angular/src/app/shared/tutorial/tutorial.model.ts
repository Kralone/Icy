export type TutorialPlacement = 'auto' | 'top' | 'bottom' | 'left' | 'right';

export interface TutorialStep {
  /** Sélecteur CSS de l’élément mis en avant. Sans cible, la bulle est centrée sur l’écran. */
  target?: string;
  title: string;
  text: string;
  placement?: TutorialPlacement;
}

export interface TutorialDefinition {
  id: string;
  /** À augmenter quand le contenu change pour reproposer le tutoriel à ceux qui l’ont déjà vu. */
  version: number;
  title: string;
  matches: (path: string) => boolean;
  steps: TutorialStep[];
}

export type TutorialStatus = 'COMPLETED' | 'DISMISSED';

export interface TutorialProgress {
  tutorialId: string;
  version: number;
  status: TutorialStatus;
  updatedAt?: string;
}
