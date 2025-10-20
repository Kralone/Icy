import { Component } from '@angular/core';
import {RouterLink, RouterOutlet} from '@angular/router';
import {CommonModule} from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-admin-menu',
  imports: [
    RouterLink,
    CommonModule
  ],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class AdminMenuComponent {
  menuItems = [
    {
      label: 'Membres',
      imageUrl: 'https://www.kakuchopurei.com/wp-content/uploads/2021/11/Star-Citizen-November-2021.jpg',
      route: '/icy/admin/members',
    },
    {
      label: 'Recrutement',
      imageUrl: 'https://static1.dualshockersimages.com/wordpress/wp-content/uploads/2022/07/Star-Citizen-3172-1-scaled.jpg',
      route: '/icy/admin/recrutement',
    },
    {
      label: 'Collections',
      imageUrl: 'https://robertsspaceindustries.com/i/b7cfa1fff5a9cfa8d09335a5cd5eb4cfdc6d881d/resize(2500,1407,cover,crop(2926,1646,0,0,D5zH9SyxCKdBd32SC5eKXVbKisohY32kUqrXpvrxgNUg8K37DJgHZAGMiBhbBwQmQH3W6G2GfLhT1aazvMh8bNmsQvoMSnN6cJrnzaAgA5H9CtD6o1ZASnWBWovYQpkTNyiehU))/75/webclips-0002-persistenthangars.webp',
      route: '/icy/admin/collections',
    },
    {
      label: 'Vaisseaux',
      imageUrl: 'https://media.starcitizen.tools/thumb/e/e2/SC_MultiShip_Roles.jpg/800px-SC_MultiShip_Roles.jpg.webp',
      route: '/icy/admin/ships',
    },
    {
      label: 'Événements',
      imageUrl: 'https://robertsspaceindustries.com/i/08fe2244a8775fd0035d274b01dab7d7902a28d4/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResf17hC1c31dKDgMVCohp9HDpEHngVixnEz/3-16_patchbanner_crop.webp',
      route: '/icy/admin/events',
    },
    {
      label: 'Actualités',
      imageUrl: 'https://media.starcitizen.tools/9/91/Careers_Overview_Concept.png',
      route: '/icy/admin/news',
    },
    {
      label: 'Coming Soon',
      imageUrl: 'https://screenplaysmag.com/wp-content/uploads/2024/12/Untitled-design-5-1.png',
      route: '/icy/admin/#',
    },
  ];
}
