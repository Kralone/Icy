
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

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
  readonly menuItems: InternalGuideMenuItem[] = [
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
    }
  ];

  constructor(private router: Router) {}

  itemRoute(item: InternalGuideMenuItem): string {
    return this.router.url.startsWith('/icy/outils')
      ? `/icy/outils/guides/${item.route}`
      : `/guides/${item.route}`;
  }
}
