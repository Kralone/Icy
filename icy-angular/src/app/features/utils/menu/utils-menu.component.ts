import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user/user.service';
import { RankOrbitComponent } from '../../../shared/rank-orbit/rank-orbit.component';
import { LoadingOverlayComponent } from '../../../shared/loading-overlay/loading-overlay.component';
import { AuthService } from '../../../core/services/auth/auth.service';

type UtilityScope = 'Interne' | 'Externe';
type UtilityMenuMode = 'public' | 'private';
type UtilityMenuItem = {
  label: string;
  imageUrl: string;
  scope: UtilityScope;
  routePublic?: string;
  routePrivate: string;
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
  menuMode: UtilityMenuMode = 'private';
  private readonly rankAliases: Record<string, string> = {
    USER: 'JUNIOR',
    MEMBRE: 'JUNIOR',
    RECRUE: 'JUNIOR'
  };
  private readonly availableRanks = ['ADMIN', 'OFFICIER', 'SPECIALISTE', 'INGENIEUR', 'ASSOCIE', 'JUNIOR'];
  constructor(
    private userService: UserService,
    private authService: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.menuMode = this.route.snapshot.data['utilityScope'] === 'public' ? 'public' : 'private';

    if (!this.authService.hasToken()) {
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
      routePrivate: '/icy/utilitaires/collection',
      scope: 'Interne' as UtilityScope,
    },
    {
      label: 'Hangar executifs',
      imageUrl: 'https://media.starcitizen.tools/b/b8/Cutter_Approaching_Checkmate_Station.png',
      routePublic: '/utilitaires/executive-hangar',
      routePrivate: '/icy/utilitaires/executive-hangar',
      scope: 'Externe' as UtilityScope,
    },
    {
      label: 'Vaisseaux',
      imageUrl: 'https://media.starcitizen.tools/thumb/f/f6/IAE2954-day5-polaris-tunnel-view.jpg/400px-IAE2954-day5-polaris-tunnel-view.jpg.webp',
      routePublic: '/utilitaires/achat-vaisseaux',
      routePrivate: '/icy/utilitaires/achat-vaisseaux',
      scope: 'Externe' as UtilityScope,
    },
    {
      label: 'Wikelo',
      imageUrl: 'https://media.starcitizen.tools/thumb/8/83/Wikelo_Hologram_-_Alpha_4.1.0.jpg/1200px-Wikelo_Hologram_-_Alpha_4.1.0.jpg.webp',
      routePublic: '/utilitaires/wikelo',
      routePrivate: '/icy/utilitaires/wikelo',
      scope: 'Externe' as UtilityScope,
    }
  ];

  get displayedItems(): UtilityMenuItem[] {
    if (this.menuMode === 'public') {
      return this.menuItems.filter((item) => item.scope === 'Externe');
    }
    return this.menuItems;
  }

  resolveRoute(item: UtilityMenuItem): string {
    if (this.menuMode === 'public') {
      return item.routePublic ?? item.routePrivate;
    }
    return item.routePrivate;
  }

  private normalizeRank(role?: string | null): string {
    const normalized = (role ?? '').trim().toUpperCase();
    const mapped = this.rankAliases[normalized] ?? normalized;
    return this.availableRanks.includes(mapped) ? mapped : 'JUNIOR';
  }
}
