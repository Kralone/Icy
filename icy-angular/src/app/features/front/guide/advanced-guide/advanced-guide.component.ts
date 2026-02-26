import { Component } from '@angular/core';
import { GuideTemplateComponent } from '../guide-template/guide-template.component';
import { GuideDocument } from '../guide-template/guide-template.types';
import { buildResourcesGuideLink } from '../resources-guide/resources-guide-link.utils';

const MINING_HEADS_DATABASE_LINK = buildResourcesGuideLink({
  line: 'fit',
  fitTab: 'modules',
  fitFilter: 'mining_laser'
});
const MINING_GADGET_DATABASE_LINK = buildResourcesGuideLink({
  line: 'fit',
  fitTab: 'tools'
});
const RESOURCES_PRICE_LINK = buildResourcesGuideLink({ line: 'planning' });

@Component({
  selector: 'front-advanced-mining-guide',
  standalone: true,
  imports: [GuideTemplateComponent],
  template: `<front-guide-template [guide]="guide"></front-guide-template>`
})
export class AdvancedMiningGuideComponent {
  readonly guide: GuideDocument = {
    slug: 'minage-avance',
    title: 'Expertise Minière : L\'Art de l\'Optimisation',
    subtitle: 'Dompter les statistiques, configurer son laser et sécuriser le Quantainium.',
    updatedAt: '25 fév. 2026',
    readTime: '20-25 min',
    difficulty: 'Confirmé à Expert',
    status: { label: 'Expertise', tone: 'writing' },
    tags: ['quantainium', 'modules', 'gadgets', 'theorycrafting', 'sub-component'],
    glossary: [
      { term: 'Overclocking', definition: 'Pousser le laser au-delà de ses limites via des modules actifs pour fracturer des roches massives.' },
      { term: 'Volatilité', definition: 'Propriété du Quantainium déclenchant un compte à rebours avant explosion dans la soute.' },
      { term: 'Extraction sélective', definition: 'Technique consistant à ne ramasser que les fragments purifiés à plus de 90%.' }
    ],
    sections: [
      {
        id: 'analyse-chirurgicale',
        title: '1. L\'Analyse Chirurgicale : Décoder la Roche',
        summary: 'Avant de tirer le moindre laser, un expert doit savoir si la roche est une mine d\'or ou un piège mortel. Apprenez à lire au-delà des pourcentages.',
        subsections: [
          {
            title: 'Le Triptyque de la Roche : Masse, Résistance, Instabilité',
            paragraphs: [
              'Une fois le scan détaillé terminé, l\'interface affiche trois valeurs critiques. Ces chiffres ne sont pas là pour la décoration : ils définissent la "santé" et la "défense" de votre cible.',
            ],
            bullets: [
              '**La Masse :** C\'est l\'inertie thermique. Plus un rocher est massif, plus il nécessite une puissance de chauffe élevée pour simplement faire bouger la jauge d\'énergie.',
              '**La Résistance :** Considérez-la comme un bouclier. Une résistance de 0.5 signifie que 50% de la puissance de votre laser est dissipée sans chauffer la roche. C\'est le facteur principal qui bloque les débutants.',
              '**L\'Instabilité :** C\'est la nervosité de la jauge. Une instabilité élevée provoque des bonds imprévisibles de l\'énergie, rendant le maintien dans la zone verte extrêmement périlleux.'
            ]
          },
          {
            title: 'Le Calcul de Faisabilité (Solo vs Multi)',
            paragraphs: [
              'Un mineur expert sait évaluer son "Seuil de Fracture" avant de gaspiller ses modules ou ses charges de gadget.',
              `Si la **Masse** combinée à la **Résistance** dépasse la puissance nominale de votre [tête de minage](${MINING_HEADS_DATABASE_LINK}), vous ne ferez jamais monter la jauge. C'est ici que l'intervention manuelle [(Gadgets)](${MINING_GADGET_DATABASE_LINK}) ou l'appel à un collègue en MOLE devient indispensable.`
            ],
            callouts: [
              {
                title: 'Le Saviez-vous ?',
                text: 'La distance de tir influe drastiquement sur le transfert d\'énergie. Si une roche résiste, rapprochez-vous prudemment : chaque mètre gagné augmente la pénétration du laser.',
                tone: 'live'
              }
            ]
          },
          {
            title: 'Lecture de la Composition : Le Ratio d\'Inertie',
            paragraphs: [
              'Ne vous laissez pas aveugler par un 2% de Janalite. Un expert calcule le **Volume de Matériaux Inertes**.',
              'Si une roche de 8000kg contient 90% d\'inertes, vous allez remplir votre soute de poussière sans valeur, même si le minerai précieux restant est de haute qualité. Visez toujours des roches où le précieux représente au moins 15 à 20% de la masse totale pour optimiser vos futurs frais de raffinage.'
            ]
          }
        ],
        callout: {
          title: 'Ressource Interne',
          text: `Retrouvez la liste complète des minerais, leur masse volumique et leur prix de vente de base dans notre [Tableau des Ressources et Minéraux](${RESOURCES_PRICE_LINK}).`,
          tone: 'writing'
        },
        imageUrl: 'https://media.starcitizen.tools/thumb/3/30/Mining_UI_3.17.png/1200px-Mining_UI_3.17.png'
      }
    ]
  };
}
