import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

import { UserService } from '../../../core/services/user/user.service';
import { RankOrbitComponent } from '../../../shared/rank-orbit/rank-orbit.component';
import { LoadingOverlayComponent } from '../../../shared/loading-overlay/loading-overlay.component';
import { memberRank } from '../../../core/services/user/member-rank';

type AdminIcon = 'users' | 'user-plus' | 'rocket' | 'calendar' | 'flag' | 'globe' | 'news' | 'book' | 'link' | 'database';

interface AdminMenuItem {
  label: string;
  description: string;
  icon: AdminIcon;
  route: string;
  requiredRoles?: string[];
}

/** Groupe de liens ; tone est la teinte de glace du groupe (triplet RVB). */
interface AdminMenuGroup {
  label: string;
  tone: string;
  items: AdminMenuItem[];
}

@Component({
  standalone: true,
  selector: 'app-admin-menu',
  imports: [
    RouterLink,
    RankOrbitComponent,
    LoadingOverlayComponent
],
  templateUrl: './menu.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
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
    SPECIALISTE: 'Spécialiste',
    INGENIEUR: 'Ingénieur',
    ASSOCIE: 'Associé',
    JUNIOR: 'Junior'
  };

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.userService.profile$.subscribe((profile) => {
      const roles = profile?.roles ?? [];
      this.activeRankKey = this.normalizeRank(memberRank(roles));
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

  readonly menuGroups: AdminMenuGroup[] = [
    {
      label: 'Communauté',
      tone: '186 230 253',
      items: [
        { label: 'Membres', description: 'Grades, pôles et fonctions', icon: 'users', route: '/icy/admin/members' },
        { label: 'Recrutement', description: 'Candidatures ouvertes et traitées', icon: 'user-plus', route: '/icy/admin/recrutement' }
      ]
    },
    {
      label: 'Activités',
      tone: '34 211 238',
      items: [
        { label: 'Opérations', description: 'Brouillons et opérations publiées', icon: 'rocket', route: '/icy/admin/operations' },
        { label: 'Événements', description: 'Calendrier et types d’événements', icon: 'calendar', route: '/icy/admin/events' },
        { label: 'Objectifs', description: 'Objectifs et modèles', icon: 'flag', route: '/icy/admin/goals' },
        { label: 'SC World Event', description: 'Événements du jeu en cours', icon: 'globe', route: '/icy/admin/sc-world-events' }
      ]
    },
    {
      label: 'Contenu',
      tone: '45 212 191',
      items: [
        { label: 'Actualités', description: 'Articles et types d’actualités', icon: 'news', route: '/icy/admin/news' },
        { label: 'Guides', description: 'Rédaction et publication', icon: 'book', route: '/icy/admin/guides' },
        { label: 'IceLink Builder', description: 'Blocs de la page IceLink', icon: 'link', route: '/icy/admin/icelinkBuilder' }
      ]
    },
    {
      label: 'Données',
      tone: '203 213 225',
      items: [
        { label: 'Catalogue', description: 'Vaisseaux, équipement, lieux et images', icon: 'database', route: '/icy/admin/data' }
      ]
    }
  ];

  /** Groupes réduits aux liens que le membre peut ouvrir ; un groupe vide disparaît. */
  get visibleGroups(): AdminMenuGroup[] {
    return this.menuGroups
      .map((group) => ({ ...group, items: group.items.filter((item) => !item.requiredRoles?.length || this.hasAnyRole(item.requiredRoles)) }))
      .filter((group) => group.items.length > 0);
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
