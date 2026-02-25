import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FrontGuideCard {
  id: number;
  title: string;
  summary: string;
  category: string;
  route?: string;
  imageUrl?: string;
  type: 'live' | 'écriture' | 'soon';
}

@Component({
  selector: 'front-guides',
  imports: [RouterLink],
  templateUrl: './guides.component.html',
  styleUrl: './guides.component.css'
})
export class GuidesComponent {
  readonly cards: FrontGuideCard[] = [
    {
      id: 1,
      title: 'Guide Minage Avance',
      summary: 'Optimisation des veines, fenetre verte et pipeline complet de vente.',
      category: 'Industrie',
      route: '/guide/minage',
      imageUrl: 'assets/images/home/activities/mining.jpg',
      type: 'écriture'
    },
    {
      id: 2,
      title: 'Guide Salvage',
      summary: 'Boucle salvage, tri des coques et workflow rentable en equipe.',
      category: 'Recuperation',
      route: '/guide/salvage',
      imageUrl: 'assets/images/home/activities/cargo.jpg',
      type: 'soon'
    },
    {
      id: 3,
      title: 'Prochain Guide',
      summary: 'En travaux, coming soon.',
      category: '',
      type: 'soon'
    },
    {
      id: 4,
      title: 'Coming Soon',
      summary: 'En travaux, coming soon.',
      category: '',
      type: 'soon'
    },
    {
      id: 5,
      title: 'Coming Soon',
      summary: 'En travaux, coming soon.',
      category: '',
      type: 'soon'
    },
    {
      id: 6,
      title: 'Coming Soon',
      summary: 'En travaux, coming soon.',
      category: '',
      type: 'soon'
    }
  ];
}
