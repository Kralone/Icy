import { Component, ChangeDetectionStrategy } from '@angular/core';
import { GuideTemplateComponent } from '../guide-template/guide-template.component';
import { GuideDocument } from '../guide-template/guide-template.types';

@Component({
  selector: 'front-hathor-guide',
  standalone: true,
  imports: [GuideTemplateComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<front-guide-template [guide]="guide"></front-guide-template>`
})
export class HathorGuideComponent {
  readonly guide: GuideDocument = {
    slug: 'operation-hathor',
    title: 'Hathor Guide Star Citizen FR',
    subtitle: 'Guide complet de l\'opération Hathor sur Star Citizen: PAF, OLP, extraction de Carinite et stratégie PvP.',
    showTopbarTabs: false,
    updatedAt: '27 fév. 2026',
    readTime: '12-15 min',
    difficulty: 'Confirmé',
    status: { label: 'Disponible', tone: 'live' },
    tags: ['hathor', 'star citizen fr', 'pvp', 'carinite', 'olp'],
    glossary: [
      {
        term: 'OLP',
        definition: 'Orbital Laser Platform. La plateforme en orbite alimentée par des batteries industrielles pour fracturer la planète.'
      },
      {
        term: 'PAF',
        definition: 'Planetary Alignment Facilities. Complexes au sol permettant d\'aligner les antennes de synchronisation.'
      },
      {
        term: 'Valakar',
        definition: 'Créatures hostiles (juvéniles) surgissant du sol lors de l\'activation des antennes ou présentes dans la grotte.'
      }
    ],
    sections: [
      {
        id: 'strategie-pvp',
        title: '⚠️ Avertissement Tactique : La Menace PvP',
        summary: 'L\'opération Hathor est une zone de conflit permanent. Contrairement à d\'autres missions, la visibilité du laser et la valeur des minerais garantissent des tentatives d\'interception par d\'autres groupes.',
        blocks: [
          {
            type: 'paragraph',
            text: '**Taille du Groupe :** Il est fortement conseillé de constituer une équipe de 5 joueurs. Rien n\'empêche des groupes plus restreints de réussir l\'opération, notamment si vous avez la chance de ne pas être dérangés, mais la force du nombre reste votre meilleure assurance-vie.'
          },
          {
            type: 'paragraph',
            text: '**Répartition :** Une équipe au sol pour l\'alignement et le minage, et une équipe aérienne pour assurer la supériorité spatiale.'
          },
          {
            type: 'paragraph',
            text: '**Présence de Vaisseau Capital :** L\'utilisation d\'un [[db:ship:Aegis Dynamics Idris-P|Idris]], d\'un [[db:ship:Roberts Space Industries Polaris|Polaris]], d\'un [[db:ship:Aegis Dynamics Hammerhead|Hammerhead]] ou d\'un [[db:ship:Crusader Industries A2 Hercules|A2]] est fortement recommandée pour imposer une zone d\'exclusion aérienne et dissuader les opportunistes.'
          }
        ]
      },
      {
        id: 'preparation',
        title: 'Préparation et Équipement',
        subsections: [
          {
            title: 'Protection Thermique',
            paragraphs: [
              'L\'armure [[db:item:Pembroke Armor|Pembroke]] est vivement recommandée pour toute opération sur Aberdeen en raison des températures de surface extrêmes qui peuvent drainer votre vitalité. Cependant, elle n\'est pas strictement indispensable si vous minimisez vos temps d\'exposition ou utilisez des véhicules climatisés. Sur Daymar, les conditions sont plus clémentes et une armure de combat standard est tout à fait suffisante.'
            ]
          },
          {
            title: 'Logistique Lourde',
            blocks: [
              {
                type: 'paragraph',
                text: '**[[db:item:MaxLift Tractor Beam|MaxLift Tractor Beam]]** : Cet outil est strictement obligatoire pour la manipulation des batteries industrielles. Le Multi-tool standard souffre d\'un manque de puissance, le rendant totalement inefficace pour stabiliser ou déplacer ces charges lourdes, particulièrement lors des transitions de grilles physiques complexes entre les plateformes de l\'OLP et l\'intérieur de vos vaisseaux.'
              },
              {
                type: 'paragraph',
                text: '**Power Suit [[db:ship:Argo Astronautics ATLS GEO|ATLS GEO]]** : Véritable plateforme logistique tout-terrain, l\'ATLS GEO est crucial pour l\'extraction sécurisée. Sa capacité de mouvement permettent de miner les fragments de Carinite Pure avec une précision chirurgicale, évitant les chocs qui pourraient déclencher une explosion dévastatrice dans l\'environnement confiné du "Pit".'
              }
            ],
          },
          {
            title: 'Communication',
            paragraphs: [
              'La réussite dépend d\'une coordination sans faille. Maintenez une veille constante sur le canal Global pour intercepter les communications ennemies ou anticiper l\'arrivée de bombardiers A2. En parallèle, l\'usage de fréquences canaux privées (Ex: VoIP, Discord) est impératif pour synchroniser les demandes d\'appui aérien et les fenêtres d\'extraction sécurisées.'
            ]
          }
        ],
        imageUrl: 'https://media.starcitizen.tools/9/92/Grim-hex-skutters-3.4.1.jpg'
      },
      {
        id: 'paf',
        title: 'Alignement et Conflits au Sol (PAF)',
        summary: 'Cette première étape cruciale nécessite l\'alignement de trois antennes distinctes pour synchroniser la télémétrie de précision avec l\'OLP (Orbital Laser Platform). Sans la validation de ces trois vecteurs au sol, le laser orbital demeure inerte et incapable de recevoir ses ordres de tir.',
        subsections: [
          {
            title: 'Hiérarchie des Accès',
            bullets: [
              '**Carte Bleue (Maintenance) :** Utilisée pour déverrouiller les sas logistiques et les baies de stockage technique. Ces cartes sont généralement dissimulées dans les petits bâtiments utilitaires, identifiables par leurs taille et forme caractéristiques. Elles constituent le premier maillon de la chaîne, permettant d\'accéder aux terminaux d\'impression nécessaires pour obtenir les accès de niveau supérieur.',
              '**Carte Rouge (Sécurité) :** Fournit une accréditation de sécurité de niveau 2. Ces cartes permettent de pénétrer dans les "Red Rooms" (bureaux Admin, Comms et Sécurité) situés stratégiquement à la base de chaque antenne. C\'est à l\'intérieur de ces salles que vous trouverez les précieuses lame d\'alignement.',
              '**Lame d\'Alignement (Blade) :** Ce sont des supports de stockage haute capacité contenant les algorithmes de synchronisation télémétrique. Trois lames doivent être insérées manuellement dans le terminal central de chaque antenne. Un délai de refroidissement forcé de 60 secondes est imposé entre chaque insertion de lame, créant une fenêtre de vulnérabilité où votre équipe doit tenir sa position contre les assauts extérieurs.'
            ]
          }
        ],
        callouts: [
          {
            title: 'Alerte PvP',
            text: 'Les joueurs attendent souvent que vous ayez fait le travail d\'alignement pour vous éliminer et voler les batteries. Il est préférable de sécuriser et d\'activer les sites l\'un après l\'autre plutôt que simultanément ; cela permet de concentrer votre puissance de défense sur un seul point et d\'éviter l\'éparpillement de vos forces face à des intercepteurs.',
            tone: 'live'
          },
          {
            title: 'Menace Locale',
            text: 'Attention aux **Valakar Juvenile** qui attaquent pendant l\'insertion des lames.',
            tone: 'alert'
          }
        ],
        imageUrl: 'https://media.starcitizen.tools/5/5b/Ruptura_PAF-III%2C_Aberdeen.webp'
      },
      {
        id: 'alimentation',
        title: ' Alimentation de l\'OLP',
        subsections: [
          {
            title: 'Batteries Industrielles',
            paragraphs: [
              'Trop lourdes pour le Multi-tool standard. L\'usage d\'un [[db:item:MaxLift Tractor Beam|MaxLift]] ou d\'un [[db:ship:Argo Astronautics ATLS|ATLS]] est donc obligatoire.'
            ]
          },
          {
            title: 'Installation Orbitale',
            paragraphs: [
              'Les slots d\'insertion se situent à l\'extrémité intérieure des deux grands bras supportant les pads d\'atterrissage de l\'OLP. Ils sont facilement identifiables par leur couleur orange vive et leur large ouverture rectangulaire, entourée de guides lumineux passant du jaune au vert une fois la batterie verrouillée.'
            ]
          },
          {
            title: 'Sécurité Orbitale',
            paragraphs: [
              'La station est un nid à PNJ, mais c\'est aussi un point de camping idéal pour les chasseurs ennemis. Votre équipe aérienne doit nettoyer l\'espace autour de l\'OLP avant que le transporteur de batteries n\'approche.'
            ]
          }
        ],
        imageUrl: 'https://media.starcitizen.tools/6/6a/Attritus_OLP%2C_Daymar.webp'
      },
      {
        id: 'tir',
        title: 'Le Tir du Laser',
        subsections: [
          {
            title: 'Clé d\'Activation (Violette/Firing Control)',
            paragraphs: [
              'Une fois les trois batteries insérées et verrouillées, vous devez vous frayer un chemin jusqu\'au terminal de contrôle central situé dans le noyau de la station orbitale. C\'est ici que vous lancerez l\'impression clé de contrôle du tir. Soyez extrêmement prudents : l\'intérieur de l\'OLP est défendu par de nombreux PNJ qui patrouillent en boucle et réapparaissent rapidement.'
            ]
          },
          {
            title: 'Mise à feu',
            paragraphs: [
              'Munis de la clé, descendez sur la lune pour localiser le bunker de tir dédié, situé à environ 1 km de la zone d\'impact prévue. Ce complexe est facilement repérable grâce à sa puissante balise lumineuse rouge de nuit. Une fois à l\'intérieur, insérez la clé pour déclencher la séquence de tir. C\'est l\'étape ultime qui précède la fracture de la croûte ; votre escorte aérienne doit impérativement sécuriser les environs du bunker pour éviter toute interruption par des intercepteurs opportunistes attirés par l\'activité.'
            ]
          }
        ],
        callout: {
          title: '⚠️ Danger Critique',
          text: 'Le tir du laser est visible par tous les joueurs sur place. Il annonce officiellement l\'ouverture prochaine de la grotte. Attendez-vous à une arrivée massive de vaisseaux dès cet instant.',
          tone: 'alert'
        },
        imageUrl: 'https://files.mmopixel.com/tinymce/7f1f5f89-781f-45dc-b81c-40ef7eb1d067.png'
      },
      {
        id: 'cave',
        title: 'La Cave (Extraction sous pression)',
        summary: 'Le laser crée une grotte instable. C\'est ici que se joue la rentabilité de l\'opération.',
        subsections: [
          {
            title: 'Défense de la Grotte',
            paragraphs: [
              'Postez un ou plusieurs gardes à l\'entrée. Les joueurs adverses tenteront de s\'infiltrer pour voler vos ressources.'
            ]
          },
          {
            title: 'Extraction de Précision',
            paragraphs: [
              'L\'[[db:ship:Argo Astronautics ATLS GEO|ATLS GEO]] est utile uniquement pour l\'extraction des plus grosses roches. Pour tout le reste, le minage à la main reste la meilleure solution pour garantir une précision maximale et éviter les accidents.'
            ],
            callouts: [
              {
                title: 'Alerte Explosion',
                text: 'Une roche qui dépasse la zone rouge explose et risque de tuer instantanément toute l\'équipe dans le périmètre confiné de la grotte. Consultez notre guide de minage dédié pour les réglages de puissance.',
                tone: 'alert'
              }
            ],
          },
          {
            title: 'Ressources',
            bullets: [
              '**Carinite Pure :** L\'objectif ultime de l\'opération (rarissime). C\'est le minerai le plus précieux et celui que vous devez cibler en priorité pour maximiser vos gains.',
              '**Carinite / Jaclium / Saldynium :** Ces minerais, bien que plus communs, restent très rentables et indispensables pour vos échanges auprès de Wikelo. Ils constituent généralement le gros de votre cargaison lors d\'une extraction réussie.'
            ]
          }
        ],
        imageUrl: 'https://media.robertsspaceindustries.com/2yaeb4x8ahmnt/source.jpg'
      },
      {
        id: 'livraison',
        title: 'Livraison chez Wikelo',
        summary: 'Le marchand Wikelo est le seul à accepter ces minerais contre des récompenses de haut niveau.',
        subsections: [
          {
            title: 'Escorte de Sortie',
            paragraphs: [
              'Le trajet entre la lune et le point de vente est la dernière opportunité pour les pirates de vous intercepter. Ne relâchez pas votre vigilance tant que les ressources ne sont pas vendues.'
            ]
          },
          {
            title: 'Récompenses',
            paragraphs: [
              'Fusils [[db:item:Parallax|Parallax]], armures Antium, ou progression vers l\'achat d\'un [[db:ship:RSI Polaris|Polaris]] ou autres vaisseaux.'
            ]
          }
        ],
        callout: {
          title: 'Outils Wikelo',
          text: 'Pour optimiser vos gains, n\'oubliez pas d\'utiliser notre outil Wikelo. Il vous permet de visualiser les récompenses et équipements que vous pouvez acquérir en fonction des stocks de minerais (Carinite Pure, Jaclium, etc.) que vous avez réussi à extraire.',
          tone: 'live'
        }
      }
    ]
  };
}
