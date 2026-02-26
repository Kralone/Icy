import { Component } from '@angular/core';
import { GuideTemplateComponent } from '../guide-template/guide-template.component';
import { GuideDocument } from '../guide-template/guide-template.types';

@Component({
  selector: 'front-mining-guide',
  standalone: true,
  imports: [GuideTemplateComponent],
  template: `<front-guide-template [guide]="guide"></front-guide-template>`
})
export class MiningGuideComponent {
  readonly guide: GuideDocument = {
    slug: 'minage',
    title: 'Guide Minage Star Citizen',
    subtitle: 'Guide complet du minage Star Citizen : de la roche brute a la vente, avec extraction, raffinage et logistique.',
    updatedAt: '22 fév. 2026',
    readTime: '15-20 min',
    difficulty: 'Débutant à Confirmé',
    status: { label: 'Écriture', tone: 'writing' },
    tags: ['minage', 'star citizen', 'fps', 'vehicule', 'vaisseau', 'credits', 'raffinage'],
    glossary: [
      {
        term: 'FPS',
        definition: 'First Person Shooter. Dans le contexte du minage, désigne l\'extraction réalisée à pied avec des outils manuels.'
      },
      {
        term: 'ROC',
        definition: 'Remote Ore Extractor. Le véhicule terrestre de base conçu spécifiquement pour la récolte de gemmes en surface.'
      },
      {
        term: 'Raffinage',
        definition: 'Processus industriel purifiant le minerai brut extraite pour augmenter drastiquement son prix de revente final.'
      },
      {
        term: 'EVA',
        definition: 'Extra Vehicular Activity. Désigne toute sortie effectuée flottant dans le vide de l\'espace en dehors d\'un vaisseau.'
      },
      {
        term: 'OreBit',
        definition: 'Attachement spécifique à clipser sur un Multi-tool pour le transformer en laser de minage portatif.'
      },
      {
        term: 'Signature',
        definition: 'Valeur numérique retournée par le radar donnant une estimation de la taille et de la composition d\'une entité minable à distance.'
      },
      {
        term: 'Matériaux inertes',
        definition: 'Poussière et roche sans aucune valeur commerciale qui occupent inutilement l\'espace de votre soute.'
      },
      {
        term: 'Sweet Spot',
        definition: 'La fenêtre d\'énergie optimale, symbolisée en vert sur l\'interface, dans laquelle la roche se fracture de manière sécurisée.'
      },
      {
        term: 'Surcharge',
        definition: 'État critique d\'une roche emmagasinant un excès d\'énergie thermique. Mène inévitablement à une explosion destructrice.'
      },
      {
        term: 'MOLE',
        definition: 'Multi-Operator Laser Extractor. Vaisseau minier industriel conçu pour être opéré par un équipage coordonné.'
      },
      {
        term: 'Gadget',
        definition: 'Appareil consommable à fixer manuellement sur une roche pour en modifier les propriétés structurelles avant la fracture.'
      },
      {
        term: 'Pont de raffinage',
        definition: 'Zone industrielle dédiée dans les stations spatiales permettant de transformer le minerai brut en marchandise commerciale de grande valeur.'
      },
      {
        term: 'Vente brute',
        definition: 'Action de vendre immédiatement le minerai sans traitement préalable. Le gain est instantané mais drastiquement réduit.'
      },
      {
        term: 'TDD',
        definition: 'Trade and Development Division. Les places boursières situées sur les grandes planètes où s\'échangent les matières premières au meilleur tarif.'
      },
      {
        term: 'Grille cargo',
        definition: 'Zone magnétique située dans la soute des vaisseaux de transport permettant de verrouiller physiquement les caisses de marchandises.'
      },
      {
        term: 'Saut quantique partiel',
        definition: 'Technique de navigation consistant à couper ses moteurs en plein trajet quantique pour réorienter son vaisseau et échapper aux embuscades prévisibles.'
      }
    ],
    sections: [
      {
        id: 'fondations',
        title: 'Les Fondations : Le minage, c\'est quoi ?',
        summary: 'Comprendre les mecaniques de base du minage Star Citizen, les differentes echelles de la profession et le cycle complet de l extraction au raffinage.',
        subsections: [
          {
            title: 'Le cycle de base',
            paragraphs: [
              'Le métier de mineur repose sur une boucle de gameplay immuable articulée autour de cinq étapes successives.'
            ],
            bullets: [
              '**Chercher :** Utiliser les scanners et le radar pour localiser les gisements exploitables.',
              '**Fracturer :** Chauffer la roche avec un laser pour la briser sans provoquer d\'explosion fatale.',
              '**Extraire :** Aspirer ou ramasser manuellement les fragments purifiés pour remplir sa soute.',
              '**Raffiner :** Traiter le minerai brut dans une station spatiale pour multiplier sa valeur commerciale.',
              '**Vendre :** Transporter la cargaison finale vers un terminal planétaire pour empocher les bénéfices.'
            ]
          },
          {
            title: 'Les trois échelles du métier',
            paragraphs: [
              'La profession est accessible à tous les budgets et se décline en trois catégories distinctes visant des ressources spécifiques.'
            ],
            bullets: [
              '**Le minage FPS :** Équipé d\'un outil multifonction, vous explorez les grottes à pied pour récolter des gemmes précieuses de petite taille comme l\'Hadanite ou la Janalite.',
              '**Le minage terrestre :** À bord d\'un véhicule spécialisé comme le ROC, vous parcourez la surface des lunes pour extraire des minéraux denses inaccessibles à la main.',
              '**Le minage spatial :** Aux commandes d\'un vaisseau dédié comme le Prospector ou le MOLE, vous attaquez d\'immenses astéroïdes pour extraire des volumes industriels nécessitant presque toujours un passage par la raffinerie.'
            ]
          },
          {
            title: 'L\'importance de la logistique',
            paragraphs: [
              'Un bon mineur doit aussi maîtriser le transport physique de sa récolte. Tout repose sur la manipulation manuelle de votre matériel et de vos marchandises.',
              'Vous devrez gérer des boîtes de stockage pour les sorties à pied, utiliser des rayons tracteurs pour déplacer vos sacoches de minerais, et interagir avec les ascenseurs de fret des stations pour acheminer votre minerai brut vers les terminaux de raffinage.'
            ]
          }
        ],
        callout: {
          title: 'Règle de sécurité',
          text: 'Ne brûlez jamais les étapes. La précipitation lors de la fracture ou du transport mène inévitablement à la perte totale de votre équipement et de votre récolte.',
          tone: 'alert'
        },
        imageUrl: 'https://storage.googleapis.com/wormholetribune/2024/07/fps-mining-01-1-min-1024x576.webp'
      },
      {
        id: 'preparation',
        title: 'Préparation et Équipement',
        summary: 'Une expédition réussie commence dans l\'inventaire de la station. Équipez-vous pour survivre à la surface comme dans le vide spatial.',
        subsections: [
          {
            title: 'La survie face aux éléments',
            paragraphs: [
              'L\'environnement est votre premier ennemi. Sortir avec une combinaison standard sur une lune hostile vous tuera en quelques minutes. Pour les environnements brûlants comme Aberdeen, l\'armure Pembroke est vitale. À l\'inverse, sur des astres glaciaux, l\'armure Novikov empêchera l\'hypothermie.',
              'Si vous prévoyez de sortir en EVA pour fracturer une roche dans l\'espace, vérifiez toujours que votre casque est équipé et scellé avant d\'ouvrir le sas de votre vaisseau. Une erreur d\'inattention en zéro gravité peux vous couter cher.',
              'Enfin, n\'oubliez jamais de glisser de la nourriture, des bouteilles d\'eau et plusieurs stylos de soin médicaux ou paramed gun dans votre armure pour tenir en vie lors des longues sessions et pallier aux potentiels accidents.'
            ],
            callouts: [
              {
                title: 'La règle du sas',
                text: 'Vérifiez deux fois plutôt qu\'une que vous portez bien votre casque et que vos stylos de soin sont équipés sur votre armure de vol avant de lancer le décollage.',
                tone: 'alert'
              }
            ]
          },
          {
            title: 'L\'équipement manuel et terrestre',
            paragraphs: [
              'Pour le minage à pied, la base absolue est le Multi-tool équipé de l\'attachement de minage OreBit. Complétez cela avec un plastron compatible avec un sac à dos lourd pour transporter un maximum de gemmes extraites.',
              'Si vous optez pour le minage motorisé, le véhicule ROC est incontournable. Il se loue facilement et se transporte dans la soute d\'un vaisseau moyen. Il permet d\'extraire de grandes quantités de minéraux de surface sans épuiser l\'oxygène de votre combinaison.'
            ]
          },
          {
            title: 'L\'équipement des vaisseaux pour débuter',
            paragraphs: [
              'Les vaisseaux miniers disposent d\'un laser principal appelé la tête de minage. Pour vos débuts, l\'équipement installé par défaut sur le Prospector ou le MOLE suffira amplement pour apprendre la profession.',
              'Vous découvrirez plus tard qu\'il est possible de changer cette pièce ou d\'y greffer des modules complexes pour optimiser vos rendements. Pour le moment, économisez vos crédits et concentrez-vous sur la maîtrise de votre laser de base.'
            ]
          }
        ],
        imageUrl: 'https://media.starcitizen.tools/e/e6/ARGO_Mole.jpg'
      },
      {
        id: 'prospection',
        title: 'La Prospection et le Scan',
        summary: 'Ne perdez pas de temps sur des roches sans valeur. Apprenez à repérer et analyser efficacement vos cibles.',
        subsections: [
          {
            title: 'Où chercher les meilleurs filons',
            paragraphs: [
              'Le choix du terrain de chasse définit votre récolte. Certains systèmes apportent une certaine sécurité grâce aux com-arrays comme Stanton. Au contraire, certains systèmes sont sans foi ni lois, comme Pyro, mais avec des minerais intéressants à récupérer.',
              'Le minage spatial vous permet d\'éviter les rencontres mais vous expose aux dangers du vide spatial.',
              'Les surfaces planétaires et les lunes proposent une densité de roches différente et ajoutent les contraintes atmosphériques ainsi que le risque de croiser d\'autres joueurs ou des pirates.',
            ]
          },
          {
            title: 'Le Ping radar et l\'approche',
            paragraphs: [
              'La recherche commence en mode Scan. En déclenchant une impulsion radar via la touche dédiée, vous ferez apparaître des signatures sous forme de repères lointains.',
              'Plus la valeur de la signature est élevée, plus le bloc de roche est massif ou concentré. Cela permet d\'ignorer les petits gisements si vous pilotez un vaisseau lourd, ou inversement de cibler les petites gemmes si vous êtes à pied.'
            ],
            callouts: [
              {
                title: 'La sécurité avant tout',
                text: 'Désactivez vos armes et vos boucliers lors de la phase de scan pur. Cela réduit votre empreinte électromagnétique et diminue le risque d\'attirer l\'attention des pirates. N\'oubliez pas de remettre vos shields pour miner !',
                tone: 'live'
              },
            ]
          },
          {
            title: 'La lecture du Scan complet',
            paragraphs: [
              'Une fois à proximité, visez le rocher pour lancer l\'analyse détaillée. Trois données dicteront votre approche.',
              'La Masse indique la puissance brute requise pour chauffer la cible. La Résistance représente la capacité du rocher à dissiper l\'énergie de votre laser sans chauffer. L\'Instabilité reflète le comportement de la jauge d\'énergie, un rocher très instable verra sa température bondir de manière imprévisible.'
            ]
          },
          {
            title: 'Savoir renoncer',
            paragraphs: [
              'C\'est la compétence la plus difficile à acquérir pour un débutant. Un rocher massif contenant une immense majorité de matériaux inertes est un gouffre financier et en temps de raffinage.',
              'Cherchez toujours des pourcentages élevés de minerais précieux. Si la composition ne vaut pas le risque ou si la résistance est supérieure à la capacité de votre matériel actuel, passez votre chemin.'
            ]
          }
        ],
      },
      {
        id: 'fracture',
        title: 'La Fracture : Le mini-jeu',
        summary: 'Chauffez la roche avec précision pour la briser en douceur. Une erreur de jugement et votre vaisseau finira en poussière.',
        subsections: [
          {
            title: 'Distance, puissance et angle de tir',
            paragraphs: [
              'La fracture obéit à des règles de physique simples. La distance entre votre vaisseau et la cible modifie directement l\'intensité du rayon. Plus vous êtes proche de la surface, plus le transfert d\'énergie sera violent.',
              'La gestion de la puissance de votre laser se fait via la molette de la souris. Vous devez ajuster ce flux en permanence pour réagir au comportement de la matière. Enfin, un angle de tir direct et perpendiculaire est toujours préférable pour éviter toute déperdition d\'énergie.'
            ]
          },
          {
            title: 'La Zone Verte et le danger de Surcharge',
            paragraphs: [
              'Dès que votre laser touche la cible, une jauge d\'énergie apparaît sur votre interface. L\'objectif unique est de faire monter le niveau d\'énergie jusqu\'à la Zone Verte, aussi appelée Sweet Spot, et de l\'y maintenir le temps de remplir la barre de progression.',
              'Si vous injectez trop de puissance, l\'énergie basculera dans la Zone Rouge de surcharge. Si cette jauge critique se remplit, le rocher explosera et projettera des débris mortels. En cas de panique, coupez immédiatement votre laser ou reculez votre vaisseau en urgence.'
            ],
            callouts: [
              {
                title: 'Le bon réflexe',
                text: 'Mieux vaut abandonner une fracture en cours et laisser la roche refroidir totalement plutôt que de risquer la destruction de votre équipement pour quelques minerais précieux.',
                tone: 'alert'
              }
            ]
          },
          {
            title: 'Contourner la résistance et l\'instabilité',
            paragraphs: [
              'Certaines roches massives refuseront de chauffer avec un équipement basique. C\'est ici que les modules de vaisseau et les gadgets entrent en jeu. Un gadget judicieusement placé à la surface du rocher lors d\'une sortie spatiale réduira drastiquement sa résistance naturelle avant même le premier tir.',
              'Face à une cible instable dont la température fait des bonds imprévisibles, l\'activation d\'un module de stabilisation lissera la courbe de chauffe pour vous garantir une fracture sereine et maîtrisée.',
              'Nous reviendrons sur la liste de ces modules plus tard dans le guide.',
            ]
          },
          {
            title: 'La coordination sur le MOLE',
            paragraphs: [
              'Les roches les plus grandes exigent de combiner la puissance de plusieurs lasers simultanément. À bord d\'un vaisseau minier lourd, la communication vocale devient vitale.',
              'Un joueur doit prendre le rôle de chef d\'orchestre. Il annonce les pourcentages de puissance requis pour que tous les tourellistes ajustent leurs lasers en parfait rythme. Une désynchronisation entre les opérateurs mène très souvent à une surcharge catastrophique.'
            ]
          }
        ],
        imageUrl: 'https://static0.dualshockersimages.com/wordpress/wp-content/uploads/2023/02/star-citizen-mole.jpg'
      },
      {
        id: 'extraction-stockage',
        title: 'L\'Extraction et le Stockage physique',
        summary: 'La roche est brisée en éclats exploitables. Il est temps de récolter votre butin et de le sécuriser dans votre soute.',
        subsections: [
          {
            title: 'Le mode Extraction',
            paragraphs: [
              'Une fois la roche fracturée en petits fragments purifiés, basculez votre laser en mode extraction via un clic droit. Les fragments prêts à être aspirés sont généralement mis en surbrillance violette sur votre interface.',
              'Ciblez en priorité les morceaux contenant le plus fort pourcentage de matériaux précieux et activez le rayon tracteur d\'extraction pour remplir votre soute. Ignorez les fragments composés exclusivement de matériaux inertes pour ne pas gâcher votre espace de stockage.'
            ]
          },
          {
            title: 'La manipulation des conteneurs physiques',
            paragraphs: [
              'Le minage moderne exige une gestion manuelle de votre logistique. Lors d\'une expédition à pied, vous devrez régulièrement transférer vos gemmes depuis votre sac à dos vers des boîtes de rangement physiques posées au sol ou dans votre vaisseau.',
              'En vaisseau minier, gardez à l\'esprit que vos sacoches de minerai sont détachables. Avec l\'aide d\'un coéquipier pilotant un vaisseau cargo, vous pouvez utiliser un rayon tracteur manuel pour détacher vos sacoches pleines et en installer des vides. Cela permet de prolonger votre session de minage indéfiniment.'
            ],
            callouts: [
              {
                title: 'L\'astuce',
                text: 'Par défaut, pour dévérouiller les modules de son vaisseau, y compris les sacs de minage, il faut utiliser "Alt Gr + K" sur votre clavier.',
                tone: 'live'
              }
            ]
          },
          {
            title: 'Le déchargement via les élévateurs de fret',
            paragraphs: [
              'De retour à la base, vous devez atterrir dans un hangar personnel, décharger manuellement vos caisses ou vos sacoches avec votre rayon tracteur, et les aligner proprement sur la grille de l\'élévateur de fret.',
              'Une fois votre cargaison placée sur la plateforme, activez le terminal de fret pour faire descendre l\'ascenseur. Cette action transfère physiquement votre récolte dans l\'inventaire local de la station, la rendant enfin disponible pour lancer un ordre de raffinage ou pour une vente directe.'
            ]
          }
        ],
        callout: {
          title: 'Le tri sélectif',
          text: 'L\'espace de votre soute est votre ressource la plus précieuse. Mieux vaut laisser un éclat rocheux sur place plutôt que de polluer votre inventaire avec des matériaux sans valeur commerciale.',
          tone: 'writing'
        },
        imageUrl: 'https://static0.dualshockersimages.com/wordpress/wp-content/uploads/2023/05/mining-odyssey.jpg'
      },
      {
        id: 'raffinage',
        title: 'Le Raffinage : Maximiser ses profits',
        summary: 'Transformer la roche brute en marchandise industrielle. Le raffinage est l\'étape incontournable pour décupler vos bénéfices.',
        subsections: [
          {
            title: 'Le fonctionnement des ponts de raffinage',
            paragraphs: [
              'Une fois votre cargaison sécurisée dans l\'inventaire de la station via l\'élévateur de fret, dirigez-vous vers la zone industrielle. Le pont de raffinage est le lieu où vous allez confier votre roche brute aux machines de la station pour en extraire la matière pure.',
              'Interagissez avec les terminaux dédiés pour sélectionner les minerais que vous souhaitez traiter.'
            ]
          },
          {
            title: 'Choisir sa méthode de traitement',
            paragraphs: [
              'Vous ferez face à plusieurs procédés industriels. Le choix de la méthode repose sur un équilibre délicat entre le temps de traitement, le coût de l\'opération et le rendement final. En tant que débutants, voici les 3 principales méthodes à connaitre :'
            ],
            bullets: [
              '**Ferron Exchange :** Très rapide et peu coûteux, mais le rendement est très faible. À utiliser uniquement si vous êtes extrêmement pressé.',
              '**Dinx Solvation :** La méthode reine pour la rentabilité. Elle offre un rendement maximal pour un prix dérisoire, mais le processus exigera plusieurs jours de patience.',
              '**Cormack Method :** Un excellent compromis. Le rendement est très bon et l\'opération est rapide, mais le prix du traitement amputera une part non négligeable de vos marges.'
            ]
          },
          {
            title: 'Vente brute contre raffinage',
            paragraphs: [
              'Le terminal vous propose également de vendre directement votre roche non raffinée. Cette solution de facilité divise approximativement par deux la valeur réelle de votre récolte.',
              'Néanmoins, la vente brute reste une option valable si vous débutez et avez un besoin urgent de liquidités pour louer du matériel.'
            ]
          }
        ],
        callout: {
          title: 'Spécialisation des stations',
          text: 'Chaque raffinerie possède des bonus de rendement pour des minerais spécifiques. Renseignez-vous sur les spécialités de votre station d\'attache pour optimiser vos revenus.',
          tone: 'live'
        },
        imageUrl: 'https://sibyllasc.fr/wp-content/uploads/2025/09/Refinery_01_V2-Min.jpg.webp'
      },
      {
        id: 'transport-vente',
        title: 'Transport final et Vente',
        summary: 'Le raffinage est terminé. Il reste une dernière étape cruciale pour transformer votre labeur en crédits durement mérités.',
        subsections: [
          {
            title: 'La logistique du transport cargo',
            paragraphs: [
              'Vos minerais raffinés sont désormais stockés dans l\'inventaire de la raffinerie. Pour les vendre, vous devez impérativement les charger dans un vaisseau de transport dédié disposant d\'une grille cargo standard.',
              'Rendez-vous aux terminaux de gestion de la raffinerie pour initier le transfert physique de la marchandise. Prenez garde à bien sélectionner le bon vaisseau cible sur l\'écran. Un vaisseau de fret moyen fera parfaitement l\'affaire pour débuter vos premières livraisons.'
            ]
          },
          {
            title: 'La navigation vers les centres de commerce',
            paragraphs: [
              'Les stations spatiales n\'achètent pas les produits raffinés à un tarif avantageux, voir pas du tout. Vous devez obligatoirement vous rendre dans les centres de commerce majeurs situés sur les planètes principales de votre système stellaire.',
              'Ces gigantesques zones d\'échanges planétaires nommées TDD sont les seules entités économiques capables d\'absorber vos volumes industriels tout en vous garantissant le meilleur prix du marché.'
            ]
          },
          {
            title: 'Anticipation des menaces et gestion du risque',
            paragraphs: [
              'Le voyage vers la surface planétaire est le moment le plus dangereux de toute votre expédition. Un vaisseau cargo lourdement chargé et peu maniable représente une cible de choix pour les syndicats criminels et les pirates.',
              'Tracez votre route de navigation avec le plus grand soin. Évitez systématiquement les trajets directs et prévisibles entre la raffinerie et la planète. Effectuez des sauts quantiques partiels pour brouiller les pistes et n\'hésitez pas à engager des chasseurs d\'escorte si la valeur de votre soute atteint plusieurs millions de crédits.'
            ]
          }
        ],
        callout: {
          title: 'L\'ultime consigne',
          text: 'Ne mettez jamais toutes vos richesses dans la même soute. Divisez vos stocks et transportez votre marchandise en plusieurs voyages distincts pour limiter la casse en cas d\'interception fatale.',
          tone: 'alert'
        },
        imageUrl: 'https://storage.googleapis.com/wormholetribune/2024/07/cargo-banner-1024x439.webp'
      }
    ]
  };
}
