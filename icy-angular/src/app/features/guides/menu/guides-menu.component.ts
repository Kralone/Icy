
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

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
  styleUrl: './guides-menu.component.css'
})
export class GuidesMenuComponent {
  readonly menuItems: InternalGuideMenuItem[] = [
    {
      label: 'Guide Minage Star Citizen',
      summary: 'Scan, fracture, extraction, raffinage et vente.',
      route: '/guides/minage-star-citizen',
      imageUrl: 'assets/images/home/activities/mining.jpg'
    },
    {
      label: 'Guide Hathor',
      summary: 'Preparation, trajet OLP et execution operationnelle.',
      route: '/guides/hathor',
      imageUrl: 'https://files.mmopixel.com/tinymce/7f1f5f89-781f-45dc-b81c-40ef7eb1d067.png'
    }
  ];
}
