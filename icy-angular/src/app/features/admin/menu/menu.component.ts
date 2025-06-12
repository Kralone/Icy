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
      label: 'Coming Soon',
      imageUrl: 'https://screenplaysmag.com/wp-content/uploads/2024/12/Untitled-design-5-1.png',
      route: '/',
    },
    {
      label: 'Coming Soon',
      imageUrl: 'https://screenplaysmag.com/wp-content/uploads/2024/12/Untitled-design-5-1.png',
      route: '/',
    },
  ];
}
