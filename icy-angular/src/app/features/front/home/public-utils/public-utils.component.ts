
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

type PublicUtilityItem = {
  label: string;
  description: string;
  imageUrl: string;
  route: string;
  /** Teinte de la carte (triplet RVB), reprise des couleurs du site. */
  tone: string;
};

@Component({
  selector: 'front-public-utils',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './public-utils.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './public-utils.component.css'
})
export class PublicUtilsComponent {
  externalItems: PublicUtilityItem[] = [
    {
      label: 'Outils et Ressources de Minage',
      description: 'Toutes les ressources dont vous avez besoin pour miner.',
      imageUrl: 'assets/images/poles/industrie.jpg',
      tone: '52 211 153',
      route: '/utilitaires/ressources-minage'
    },
    {
      label: 'Hangars exécutifs',
      description: 'Etat de disponibilité des hangars et équipages.',
      imageUrl: 'assets/images/home/carousel/img2.jpg',
      tone: '34 211 238',
      route: '/utilitaires/executive-hangar'
    },
    {
      label: 'Vaisseaux',
      description: 'Vous rêver de vous offrir votre prochain vaisseau ? C\'est par ici !',
      imageUrl: 'assets/images/home/carousel/img6.jpg',
      tone: '186 230 253',
      route: '/utilitaires/achat-vaisseaux'
    },
    {
      label: 'Wikelo',
      description: 'Données vaisseaux et outils de consultation.',
      imageUrl: 'assets/images/home/carousel/img5.jpg',
      tone: '251 191 36',
      route: '/utilitaires/wikelo'
    }
  ];
}
