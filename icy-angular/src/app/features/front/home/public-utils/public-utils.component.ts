
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type PublicUtilityItem = {
  label: string;
  description: string;
  imageUrl: string;
  route: string;
};

@Component({
  selector: 'front-public-utils',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './public-utils.component.html',
  styleUrl: './public-utils.component.css'
})
export class PublicUtilsComponent {
  externalItems: PublicUtilityItem[] = [
    {
      label: 'Outils et Ressources de Minage',
      description: 'Toutes les ressources dont vous avez besoin pour miner.',
      imageUrl: 'https://sibyllasc.fr/wp-content/uploads/2025/09/Refinery_01_V2-Min.jpg.webp',
      route: '/utilitaires/ressources-minage'
    },
    {
      label: 'Hangars exécutifs',
      description: 'Etat de disponibilité des hangars et équipages.',
      imageUrl: 'https://media.starcitizen.tools/b/b8/Cutter_Approaching_Checkmate_Station.png',
      route: '/utilitaires/executive-hangar'
    },
    {
      label: 'Vaisseaux',
      description: 'Vous rêver de vous offrir votre prochain vaisseau ? C\'est par ici !',
      imageUrl: 'https://media.starcitizen.tools/thumb/f/f6/IAE2954-day5-polaris-tunnel-view.jpg/400px-IAE2954-day5-polaris-tunnel-view.jpg.webp',
      route: '/utilitaires/achat-vaisseaux'
    },
    {
      label: 'Wikelo',
      description: 'Données vaisseaux et outils de consultation.',
      imageUrl: 'https://media.starcitizen.tools/thumb/8/83/Wikelo_Hologram_-_Alpha_4.1.0.jpg/1200px-Wikelo_Hologram_-_Alpha_4.1.0.jpg.webp',
      route: '/utilitaires/wikelo'
    }
  ];
}
