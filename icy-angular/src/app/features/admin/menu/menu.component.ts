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
      route: '/events',
    },
    {
      label: 'Collections',
      imageUrl: 'https://robertsspaceindustries.com/i/b7cfa1fff5a9cfa8d09335a5cd5eb4cfdc6d881d/resize(2500,1407,cover,crop(2926,1646,0,0,D5zH9SyxCKdBd32SC5eKXVbKisohY32kUqrXpvrxgNUg8K37DJgHZAGMiBhbBwQmQH3W6G2GfLhT1aazvMh8bNmsQvoMSnN6cJrnzaAgA5H9CtD6o1ZASnWBWovYQpkTNyiehU))/75/webclips-0002-persistenthangars.webp',
      route: '/icy/admin/collections',
    },
    {
      label: 'Coming Soon',
      imageUrl: 'https://screenplaysmag.com/wp-content/uploads/2024/12/Untitled-design-5-1.png',
      route: '/',
    },
  ];
}
