import { Component, ChangeDetectionStrategy } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<front-guide-template [guide]="guide"></front-guide-template>`
})
export class AdvancedMiningGuideComponent {
  readonly guide: GuideDocument = {
    slug: 'minage-avance',
    title: 'Expertise Minière : L\'Art de l\'Optimisation',
    subtitle: 'Maîtrisez les statistiques, configurez votre laser et dominez le marché des ressources.',
    updatedAt: '27 fév. 2026',
    readTime: '30-40 min',
    difficulty: 'Expert',
    status: { label: 'Complet', tone: 'live' },
    tags: ['quantainium', 'modules', 'gadgets', 'raffinage', 'logistique'],
    glossary: [
      { term: 'Overclocking', definition: 'Pousser le laser via des modules actifs pour fracturer des roches dépassant la masse théorique du vaisseau.' },
      { term: 'Volatilité', definition: 'Compte à rebours thermique du Quantainium menant à l\'explosion de la soute.' },
      { term: 'Cluster', definition: 'Regroupement dense de gisements permettant une session intensive sans saut quantique.' },
      { term: 'Fenêtre de Charge', definition: 'Aussi appelée Sweet Spot. Zone verte d\'énergie optimale.' },
      { term: 'Filtrage', definition: 'Capacité des modules à rejeter les matériaux inertes lors de l\'aspiration.' },
      { term: 'SCU', definition: 'Standard Cargo Unit. Unité de mesure universelle du volume de stockage.' }
    ],
    sections: [
      {
        id: 'analyse-chirurgicale',
        title: '1. L\'Analyse Chirurgicale : Décoder la Roche',
        summary: 'Savoir lire au-delà des pourcentages pour évaluer la rentabilité réelle.',
        subsections: [
          {
            title: 'Le Triptyque : Masse, Résistance, Instabilité',
            paragraphs: [
              'Le scan détaillé affiche trois valeurs qui définissent la "défense" thermique de votre cible.'
            ],
            bullets: [
              '**Masse :** L\'inertie thermique. Plus elle est élevée, plus il faut de watts pour amorcer la chauffe.',
              '**Résistance :** Le bouclier thermique. Une valeur de 0.5 dissipe 50% de la puissance de votre laser.',
              '**Instabilité :** La nervosité de la jauge. Elle provoque des bonds d\'énergie imprévisibles.'
            ]
          }
        ],
        imageUrl: 'https://media.starcitizen.tools/thumb/3/30/Mining_UI_3.17.png/1200px-Mining_UI_3.17.png'
      },
      {
        id: 'armurerie-optimisation',
        title: '2. L\'Armurerie : Configurer son Laser',
        summary: 'Choisir son arme selon son châssis et la spécialisation de ses modules.',
        subsections: [
          {
            title: 'Choisir sa Tête : Solo vs Multi',
            paragraphs: [
              'En 2026, la méta sépare les systèmes modulaires du système intégré de Drake.'
            ],
            bullets: [
              `**S1 - [[db:ship:MISC Prospector|MISC Prospector]] :** Têtes interchangeables comme l'[[db:item:Helix I Mining Laser|Helix I]] (vitesse) ou le [[db:item:Hofstede-S1 Mining Laser|Lancet S1]] (stabilité).`,
              `**S2 - [[db:ship:Argo Astronautics MOLE|Argo MOLE]] :** Puissance S2 pour percer les résistances massives.`,
              '**Le Golem (Drake) :** Laser **Pitman** fixe. Malus natifs (+25% res / +35% instab) compensables uniquement par les modules.'
            ]
          },
          {
            title: 'Modules Passifs vs Actifs',
            paragraphs: [
              'Les modules corrigent les défauts ou décuplent la puissance brute.'
            ],
            bullets: [
              '**Passifs :** Bonus permanents (Focus pour la zone verte, Vauxite pour la résistance).',
              '**Actifs :** Charges limitées (Surge pour le pic d\'énergie, Stampede pour la fragmentation).'
            ]
          }
        ],
        imageUrl: 'https://media.starcitizen.tools/thumb/e/e6/ARGO_Mole.jpg/1200px-ARGO_Mole.jpg'
      },
      {
        id: 'gadgets-terrain',
        title: '3. Les Gadgets : L\'Intervention Manuelle',
        summary: 'Quand le laser ne suffit plus, l\'EVA devient obligatoire pour repousser les limites physiques.',
        subsections: [
          {
            title: 'Sortir du Cockpit',
            paragraphs: [
              'Certains gisements dépassent les capacités de votre vaisseau. L\'installation d\'un gadget manuel peut réduire la masse ou la résistance de 25% à 50%.'
            ],
            bullets: [
              `**[[db:item:Sabir Mining Gadget|Sabir]] :** Indispensable sur le Golem pour stabiliser l'instabilité native.`,
              `**[[db:item:Borehole Mining Gadget|Borehole]] :** Facilite la chauffe des roches massives en réduisant la résistance.`,
              `**[[db:item:Optimite Mining Gadget|Optimite]] :** Élargit drastiquement la fenêtre de charge pour une fracture sécurisée.`
            ]
          },
          {
            title: 'Le Mini-jeu de Calibration',
            paragraphs: [
              'Une fois posé sur la roche, le gadget doit être calibré. Un succès augmente ses bonus, un échec peut provoquer une surcharge prématurée du gisement.'
            ]
          }
        ],
        imageUrl: 'https://media.starcitizen.tools/thumb/e/e3/Mining_gadget_installation.jpg/1200px-Mining_gadget_installation.jpg'
      },
      {
        id: 'quantainium-run',
        title: '4. La Chasse au Quantainium (Le Graal)',
        summary: '15 minutes entre la fortune et la désintégration totale.',
        subsections: [
          {
            title: 'Le Cycle de Volatilité',
            paragraphs: [
              'Dès que le premier morceau entre en soute, le timer de 15 minutes démarre. Votre interface de soute clignotera en jaune, puis en rouge à 5 minutes du terme.'
            ],
            bullets: [
              '**Fracture en chaîne :** Fracturez TOUTES les sous-roches avant d\'aspirer le moindre fragment. L\'extraction doit être la dernière étape.',
              '**Refroidissement :** Évitez les chocs et les manœuvres brusques ; les dégâts de coque accélèrent l\'instabilité du Quantainium.'
            ]
          }
        ],
        callout: {
          title: 'Alerte Ejection',
          text: 'En cas de bip continu rapide, éjectez la cargaison (Alt+J) ou préparez-vous à perdre votre vaisseau.',
          tone: 'alert'
        }
      },
      {
        id: 'raffinage-strategie',
        title: '5. Raffinage et Logistique',
        summary: 'Transformer la roche brute en crédits. Le choix de la méthode définit votre marge bénéficiaire.',
        subsections: [
          {
            title: 'Les Méthodes de Traitement',
            paragraphs: [
              'Chaque méthode à la raffinerie propose un compromis entre rendement, temps et coût.'
            ],
            bullets: [
              '**Dinx Solvation :** Rendement maximal (95%+), coût faible, mais extrêmement lent (plusieurs jours). La méta pour le Quantainium.',
              '**Ferron Exchange :** Très rapide, mais gaspille jusqu\'à 50% du minerai. À éviter pour l\'optimisation.',
              '**Cormack Method :** Excellent compromis temps/rendement pour les minerais standards.'
            ]
          },
          {
            title: 'Bonus de Station',
            paragraphs: [
              'Certaines raffineries (comme HUR-L3) offrent des bonus de rendement pour le Quantainium, tandis que d\'autres se spécialisent dans les gaz ou les métaux lourds.'
            ]
          }
        ],
        imageUrl: 'https://sibyllasc.fr/wp-content/uploads/2025/09/Refinery_01_V2-Min.jpg.webp'
      },
      {
        id: 'transport-vente',
        title: '6. Transport et Vente Haute Fidélité',
        summary: 'Le dernier kilomètre est le plus dangereux. Sécurisez vos bénéfices face à la piraterie.',
        subsections: [
          {
            title: 'Navigation Tactique',
            paragraphs: [
              'Ne tracez jamais de ligne droite entre la raffinerie et la TDD planétaire. Utilisez des sauts quantiques partiels pour dévier de la route commerciale standard.'
            ],
            bullets: [
              '**Où vendre ? :** Les TDD des capitales (Area18, Lorville, New Babbage) offrent les meilleurs tarifs pour les produits raffinés.',
              '**Le Risque Piraterie :** Si votre soute dépasse les 2 millions d\'UEC, envisagez une escorte légère. Un [[db:ship:Anvil Aerospace Arrow|Arrow]] de soutien est moins cher qu\'une cargaison perdue.'
            ]
          }
        ],
        callout: {
          title: 'Optimisation de Marché',
          text: `Le prix des minerais fluctue en temps réel selon la demande des joueurs. [Vérifiez les tarifs actuels](${RESOURCES_PRICE_LINK}).`,
          tone: 'live'
        }
      }
    ]
  };
}
