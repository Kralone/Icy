import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FrontGuideCard {
  id: number;
  title: string;
  summary: string;
  category: string;
  route: string;
  imageUrl?: string;
  type: 'live' | 'écriture';
}

@Component({
  selector: 'front-guides',
  imports: [RouterLink],
  templateUrl: './guides.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './guides.component.css'
})
export class GuidesComponent {
  readonly cards: FrontGuideCard[] = [
    {
      id: 1,
      title: 'Guide Minage Star Citizen',
      summary: 'Guide minage Star Citizen complet: scan, fracture, extraction, raffinage et vente.',
      category: 'Industrie',
      route: '/guides/minage-star-citizen',
      imageUrl: 'assets/images/home/activities/mining.jpg',
      type: 'écriture'
    },
    {
      id: 2,
      title: 'Guide Hathor',
      summary: 'Préparation, trajet OLP, extraction de Carinite et sécurisation PvP.',
      category: 'Exploration',
      route: '/guides/hathor',
      imageUrl: 'https://files.mmopixel.com/tinymce/7f1f5f89-781f-45dc-b81c-40ef7eb1d067.png',
      type: 'live'
    },
    {
      id: 3,
      title: 'Guide Salvage',
      summary: 'Tri des coques, extraction et revente sécurisée.',
      category: 'Industrie',
      route: '/guides/salvage',
      imageUrl: 'assets/images/home/activities/salvage.jpg',
      type: 'live'
    },
    {
      id: 4,
      title: 'Guide Minage avancé',
      summary: 'Réglages experts, gadgets, risques et pipeline de production.',
      category: 'Industrie',
      route: '/guides/minage/confirmed',
      imageUrl: 'assets/images/home/activities/mining.jpg',
      type: 'live'
    }
  ];
}
