import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user/user.service';
import { RankOrbitComponent } from '../../../shared/rank-orbit/rank-orbit.component';
import { LoadingOverlayComponent } from '../../../shared/loading-overlay/loading-overlay.component';
import { AuthService } from '../../../core/services/auth/auth.service';

type UtilityScope = 'Interne' | 'Public';
type UtilityMenuItem = {
  label: string;
  imageUrl: string;
  scope: UtilityScope;
  route: string;
};

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
  isMember = false;
  private readonly rankAliases: Record<string, string> = {
    USER: 'JUNIOR',
    MEMBRE: 'JUNIOR',
    RECRUE: 'JUNIOR'
  };
  private readonly availableRanks = ['ADMIN', 'OFFICIER', 'SPECIALISTE', 'INGENIEUR', 'ASSOCIE', 'JUNIOR'];
  constructor(
    private userService: UserService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.isMember = this.authService.hasToken();

    if (!this.isMember) {
      this.isLoading = false;
      this.cardsVisible = true;
      return;
    }

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

  menuItems: UtilityMenuItem[] = [
    {
      label: 'Collections',
      imageUrl: 'https://robertsspaceindustries.com/i/b7cfa1fff5a9cfa8d09335a5cd5eb4cfdc6d881d/resize(2500,1407,cover,crop(2926,1646,0,0,D5zH9SyxCKdBd32SC5eKXVbKisohY32kUqrXpvrxgNUg8K37DJgHZAGMiBhbBwQmQH3W6G2GfLhT1aazvMh8bNmsQvoMSnN6cJrnzaAgA5H9CtD6o1ZASnWBWovYQpkTNyiehU))/75/webclips-0002-persistenthangars.webp',
      route: '/utilitaires/collection',
      scope: 'Interne' as UtilityScope,
    },
    {
      label: 'Ressources minage',
      imageUrl: 'https://sibyllasc.fr/wp-content/uploads/2025/09/Refinery_01_V2-Min.jpg.webp',
      route: '/utilitaires/ressources-minage',
      scope: 'Public' as UtilityScope,
    },
    {
      label: 'Fiches minage',
      imageUrl: 'https://media.starcitizen.tools/thumb/d/d3/Comm-Link-Orion_Mining.jpg/1200px-Comm-Link-Orion_Mining.jpg.webp',
      route: '/utilitaires/fiches-minage',
      scope: 'Interne' as UtilityScope,
    },
    {
      label: 'Hangar executifs',
      imageUrl: 'https://media.starcitizen.tools/b/b8/Cutter_Approaching_Checkmate_Station.png',
      route: '/utilitaires/executive-hangar',
      scope: 'Public' as UtilityScope,
    },
    {
      label: 'Vaisseaux',
      imageUrl: 'https://media.starcitizen.tools/thumb/f/f6/IAE2954-day5-polaris-tunnel-view.jpg/400px-IAE2954-day5-polaris-tunnel-view.jpg.webp',
      route: '/utilitaires/achat-vaisseaux',
      scope: 'Public' as UtilityScope,
    },
    {
      label: 'Wikelo',
      imageUrl: 'https://media.starcitizen.tools/thumb/8/83/Wikelo_Hologram_-_Alpha_4.1.0.jpg/1200px-Wikelo_Hologram_-_Alpha_4.1.0.jpg.webp',
      route: '/utilitaires/wikelo',
      scope: 'Public' as UtilityScope,
    }
  ];

  get publicItems(): UtilityMenuItem[] {
    return this.menuItems.filter((item) => item.scope === 'Public');
  }

  get internalItems(): UtilityMenuItem[] {
    return this.menuItems.filter((item) => item.scope === 'Interne');
  }

  private normalizeRank(role?: string | null): string {
    const normalized = (role ?? '').trim().toUpperCase();
    const mapped = this.rankAliases[normalized] ?? normalized;
    return this.availableRanks.includes(mapped) ? mapped : 'JUNIOR';
  }
}
