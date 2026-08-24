import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { UserService } from '../../../core/services/user/user.service';
import { RankOrbitComponent } from '../../../shared/rank-orbit/rank-orbit.component';
import { LoadingOverlayComponent } from '../../../shared/loading-overlay/loading-overlay.component';

@Component({
  standalone: true,
  selector: 'app-admin-menu',
  imports: [
    RouterLink,
    RankOrbitComponent,
    LoadingOverlayComponent
],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class AdminMenuComponent {
  isLoading = true;
  cardsVisible = false;
  activeRankKey = 'JUNIOR';
  activeRankLabel = 'Junior';
  private roles: string[] = [];
  private readonly rankAliases: Record<string, string> = {
    USER: 'JUNIOR',
    MEMBRE: 'JUNIOR',
    RECRUE: 'JUNIOR'
  };
  private readonly availableRanks = ['ADMIN', 'OFFICIER', 'SPECIALISTE', 'INGENIEUR', 'ASSOCIE', 'JUNIOR'];
  private readonly rankLabels: Record<string, string> = {
    ADMIN: 'Directeur',
    OFFICIER: 'Officier',
    SPECIALISTE: 'Specialiste',
    INGENIEUR: 'Ingenieur',
    ASSOCIE: 'Associe',
    JUNIOR: 'Junior'
  };

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.userService.profile$.subscribe((profile) => {
      const roles = profile?.roles ?? [];
      this.activeRankKey = this.normalizeRank(roles[0]);
      this.activeRankLabel = this.rankLabels[this.activeRankKey] ?? this.activeRankKey;
      this.roles = roles.map((role) => (role ?? '').trim().toUpperCase());
    });
    this.userService.getMyProfile().subscribe({
      next: () => {
        this.isLoading = false;
        this.cardsVisible = true;
      },
      error: () => {
        this.isLoading = false;
        this.cardsVisible = true;
      }
    });
  }

  menuItems = [
    {
      label: 'Membres',
      imageUrl: 'https://swissstarships.org/forums/uploads/monthly_2025_05/dr-fischer-invictus-idris-crew.webp.536e4b2ee37db43cd793445d1b79e763.webp',
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
      label: 'Data',
      imageUrl: 'https://haus-enten.de/wordpress/wp-content/uploads/2019/08/news-header-crimestat-console.jpg',
      route: '/icy/admin/data',
    },
    {
      label: 'Objectifs',
      imageUrl: 'https://images.cybersport.ru/images/material-card/plain/6d/6de6fece-dd72-48f6-89d0-d1117b131f86.jpg@jpg',
      route: '/icy/admin/goals',
    },
    {
      label: 'Événements',
      imageUrl: 'https://robertsspaceindustries.com/i/08fe2244a8775fd0035d274b01dab7d7902a28d4/ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjResf17hC1c31dKDgMVCohp9HDpEHngVixnEz/3-16_patchbanner_crop.webp',
      route: '/icy/admin/events',
    },
    {
      label: 'SC World Event',
      imageUrl: 'https://robertsspaceindustries.com/i/20a2ccbe7f81fbe1a5512b046067441eaf57c220/resize(3000,1686,cover,crop(3050,1714,0,0,ADdPNihJzmPbNuTnFsH1DqUeqBRpXdSXVVtgJTyDDgscGKrzJuoFjReseXgqDduTjtPe7KFzRJ9FYxqKAAfoNREtv))/85/starcitizen-43-patch-thumbnail0101.webp',
      route: '/icy/admin/sc-world-events',
    },
    {
      label: 'Actualités',
      imageUrl: 'https://media.starcitizen.tools/9/91/Careers_Overview_Concept.png',
      route: '/icy/admin/news',
    },
    {
      label: 'IceLink Builder',
      imageUrl: 'https://media.starcitizen.tools/9/9c/Microtech-new-babbage-cityscape-01.jpg',
      route: '/icy/admin/icelinkBuilder',
    },
    {
      label: 'Orbit Spinner Maker',
      imageUrl: 'https://images.hdqwalls.com/download/star-citizen-to-3840x2160.jpg',
      route: '/icy/admin/orbit-spinner-maker',
      requiredRoles: ['ADMIN'],
    },
  ];

  get visibleMenuItems() {
    return this.menuItems.filter((item) => {
      if (!item.requiredRoles?.length) return true;
      return this.hasAnyRole(item.requiredRoles);
    });
  }

  private hasAnyRole(requiredRoles: string[]): boolean {
    const normalizedRequired = requiredRoles.map((role) => role.trim().toUpperCase());
    return this.roles.some((role) => normalizedRequired.includes(role));
  }

  private normalizeRank(role?: string | null): string {
    const normalized = (role ?? '').trim().toUpperCase();
    const mapped = this.rankAliases[normalized] ?? normalized;
    return this.availableRanks.includes(mapped) ? mapped : 'JUNIOR';
  }
}
