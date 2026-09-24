
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GuideService } from '../../../core/services/guide/guide.service';

type InternalGuideMenuItem = {
  label: string;
  summary: string;
  imageUrl: string;
  route: string;
};

@Component({
  standalone: true,
  selector: 'app-guides-menu',
  imports: [RouterLink],
  templateUrl: './guides-menu.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './guides-menu.component.css'
})
export class GuidesMenuComponent {
  menuItems: InternalGuideMenuItem[] = [
    {
      label: 'Guide Minage Star Citizen',
      summary: 'Scan, fracture, extraction, raffinage et vente.',
      route: 'minage-star-citizen',
      imageUrl: 'assets/images/home/activities/mining.jpg'
    },
    {
      label: 'Guide Hathor',
      summary: 'Preparation, trajet OLP et execution operationnelle.',
      route: 'hathor',
      imageUrl: 'https://files.mmopixel.com/tinymce/7f1f5f89-781f-45dc-b81c-40ef7eb1d067.png'
    },
    {
      label: 'Guide Salvage',
      summary: 'Tri des coques, extraction et revente sécurisée.',
      route: 'salvage',
      imageUrl: 'assets/images/home/activities/salvage.jpg'
    },
    {
      label: 'Guide Minage avancé',
      summary: 'Réglages experts, gadgets, risques et pipeline de production.',
      route: 'minage/confirmed',
      imageUrl: 'assets/images/home/activities/mining.jpg'
    }
  ];

  constructor(private router: Router, private readonly guideService: GuideService) {
    this.guideService.listPublished().subscribe({
      next: (guides) => {
        const images: Record<string, string> = {
          'minage-star-citizen': 'assets/images/home/activities/mining.jpg',
          salvage: 'assets/images/home/activities/salvage.jpg',
          'minage-confirmed': 'assets/images/home/activities/mining.jpg',
          hathor: 'https://files.mmopixel.com/tinymce/7f1f5f89-781f-45dc-b81c-40ef7eb1d067.png'
        };
        const routes: Record<string, string> = { 'minage-confirmed': 'minage/confirmed' };
        this.menuItems = guides.map((guide) => ({ label: guide.title, summary: guide.summary ?? '', route: routes[guide.slug] ?? guide.slug, imageUrl: images[guide.slug] ?? 'assets/images/home/activities/mining.jpg' }));
      }
    });
  }

  itemRoute(item: InternalGuideMenuItem): string {
    return this.router.url.startsWith('/icy/outils')
      ? `/icy/outils/guides/${item.route}`
      : `/guides/${item.route}`;
  }
}
