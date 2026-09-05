import { Component, ChangeDetectionStrategy } from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user/user.service';
import { RankOrbitComponent } from '../../../shared/rank-orbit/rank-orbit.component';
import { LoadingOverlayComponent } from '../../../shared/loading-overlay/loading-overlay.component';
import { AuthService } from '../../../core/services/auth/auth.service';

type UtilityScope = 'Interne' | 'Public';
type UtilityMenuItem = {
  label: string;
  imageUrl: string;
  scope: UtilityScope;
  path: string;
};

@Component({
  standalone: true,
  selector: 'app-utils-menu',
  imports: [
    RouterLink,
    RankOrbitComponent,
    LoadingOverlayComponent
],
  templateUrl: './utils-menu.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './utils-menu.component.css'
})
export class UtilsMenuComponent {
  isLoading = true;
  cardsVisible = false;
  activeRankKey = 'JUNIOR';
  isMemberPresentation = false;
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
    this.isMemberPresentation = this.route.snapshot.data['presentation'] === 'member' && this.authService.hasToken();

    if (!this.isMemberPresentation) {
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
      path: 'collection',
      scope: 'Interne' as UtilityScope,
    },
    {
      label: 'Ressources minage',
      imageUrl: 'https://sibyllasc.fr/wp-content/uploads/2025/09/Refinery_01_V2-Min.jpg.webp',
      path: 'ressources-minage',
      scope: 'Public' as UtilityScope,
    },
    {
      label: 'Fiches minage',
      imageUrl: 'https://media.starcitizen.tools/thumb/d/d3/Comm-Link-Orion_Mining.jpg/1200px-Comm-Link-Orion_Mining.jpg.webp',
      path: 'fiches-minage',
      scope: 'Interne' as UtilityScope,
    },
    {
      label: 'Hangar executifs',
      imageUrl: 'https://media.starcitizen.tools/b/b8/Cutter_Approaching_Checkmate_Station.png',
      path: 'executive-hangar',
      scope: 'Public' as UtilityScope,
    },
    {
      label: 'Vaisseaux',
      imageUrl: 'https://media.starcitizen.tools/thumb/f/f6/IAE2954-day5-polaris-tunnel-view.jpg/400px-IAE2954-day5-polaris-tunnel-view.jpg.webp',
      path: 'achat-vaisseaux',
      scope: 'Public' as UtilityScope,
    },
    {
      label: 'Wikelo',
      imageUrl: 'https://media.starcitizen.tools/thumb/8/83/Wikelo_Hologram_-_Alpha_4.1.0.jpg/1200px-Wikelo_Hologram_-_Alpha_4.1.0.jpg.webp',
      path: 'wikelo',
      scope: 'Public' as UtilityScope,
    }
  ];

  get publicItems(): UtilityMenuItem[] {
    return this.menuItems.filter((item) => item.scope === 'Public');
  }

  get internalItems(): UtilityMenuItem[] {
    return this.menuItems.filter((item) => item.scope === 'Interne');
  }

  itemRoute(item: UtilityMenuItem): string {
    const base = this.isMemberPresentation ? '/icy/outils' : '/utilitaires';
    return `${base}/${item.path}`;
  }

  private normalizeRank(role?: string | null): string {
    const normalized = (role ?? '').trim().toUpperCase();
    const mapped = this.rankAliases[normalized] ?? normalized;
    return this.availableRanks.includes(mapped) ? mapped : 'JUNIOR';
  }
}
