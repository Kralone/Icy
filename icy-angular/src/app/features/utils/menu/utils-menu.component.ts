import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user/user.service';
import { RankOrbitComponent } from '../../../shared/rank-orbit/rank-orbit.component';
import { LoadingOverlayComponent } from '../../../shared/loading-overlay/loading-overlay.component';

@Component({
  standalone: true,
  selector: 'app-utils-menu',
  imports: [
    CommonModule,
    RouterLink,
    RankOrbitComponent,
    LoadingOverlayComponent
  ],
  templateUrl: './utils-menu.component.html',
  styleUrl: './utils-menu.component.css'
})
export class UtilsMenuComponent {
  isLoading = true;
  cardsVisible = false;
  activeRankKey = 'JUNIOR';
  private readonly rankAliases: Record<string, string> = {
    USER: 'JUNIOR',
    MEMBRE: 'JUNIOR',
    RECRUE: 'JUNIOR'
  };
  private readonly availableRanks = ['ADMIN', 'OFFICIER', 'SPECIALISTE', 'INGENIEUR', 'ASSOCIE', 'JUNIOR'];
  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.userService.profile$.subscribe((profile) => {
      const roles = profile?.roles ?? [];
      this.activeRankKey = this.normalizeRank(roles[0]);
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
      label: 'Collections',
      imageUrl: 'https://robertsspaceindustries.com/i/b7cfa1fff5a9cfa8d09335a5cd5eb4cfdc6d881d/resize(2500,1407,cover,crop(2926,1646,0,0,D5zH9SyxCKdBd32SC5eKXVbKisohY32kUqrXpvrxgNUg8K37DJgHZAGMiBhbBwQmQH3W6G2GfLhT1aazvMh8bNmsQvoMSnN6cJrnzaAgA5H9CtD6o1ZASnWBWovYQpkTNyiehU))/75/webclips-0002-persistenthangars.webp',
      route: '/icy/utilitaires/collection',
    },
    {
      label: 'Hangar executifs',
      imageUrl: 'https://media.starcitizen.tools/b/b8/Cutter_Approaching_Checkmate_Station.png',
      route: '/icy/utilitaires/executive-hangar',
    },
    {
      label: 'Wikelo',
      imageUrl: 'https://media.starcitizen.tools/thumb/8/83/Wikelo_Hologram_-_Alpha_4.1.0.jpg/1200px-Wikelo_Hologram_-_Alpha_4.1.0.jpg.webp',
      route: '/icy/utilitaires/wikelo',
    }
  ];

  private normalizeRank(role?: string | null): string {
    const normalized = (role ?? '').trim().toUpperCase();
    const mapped = this.rankAliases[normalized] ?? normalized;
    return this.availableRanks.includes(mapped) ? mapped : 'JUNIOR';
  }
}
