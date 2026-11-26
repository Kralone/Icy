import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectionStrategy } from '@angular/core';

import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NavIconComponent, NavIconKey } from '../nav-icon/nav-icon.component';
import { AuthService } from '../../core/services/auth/auth.service';
import { ScwePlayerService } from '../../core/services/scworldevent/scwe-player.service';
import { UserService } from '../../core/services/user/user.service';

type SidebarItem = {
  icon: NavIconKey;
  label: string;
  link: string;
  kind?: 'scwe';
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NavIconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './sidebar.component.html',
  // Palette « Halo » : icônes bleu glacé à léger halo cyan, étoiles du logo en cyan.
  styles: `
    .nav-icon-halo {
      flex: none;
      color: #e0f2fe;
      --nav-icon-accent: #22d3ee;
      filter: drop-shadow(0 0 1.5px rgb(103 232 249 / 0.47)) drop-shadow(0 0 5px rgb(103 232 249 / 0.47));
    }
  `,
})
export class SidebarComponent implements OnInit {
  @Input() isCollapsed = false;
  @Output() requestClose = new EventEmitter<void>();

  isAdmin = false;
  hasActiveScEvent = false;

  menuItems: SidebarItem[] = [
    { icon: 'dashboard', label: 'Dashboard', link: '/icy/dashboard' },

    // ✅ route corrigée (sinon NG04002)
    { icon: 'scwe', label: 'SC World Events', link: '/icy/scwe', kind: 'scwe' },

    { icon: 'hangar', label: 'Mon Hangar', link: '/icy/hangar' },
    { icon: 'fleet', label: 'La flotte', link: '/icy/fleet' },
    { icon: 'events', label: 'Events', link: '/icy/events' },
    { icon: 'goals', label: 'Objectifs', link: '/icy/goals' },
    { icon: 'poles', label: 'Pôles', link: '/icy/poles' },
    { icon: 'bank', label: 'Banque', link: '/icy/banque' },
    { icon: 'guides', label: 'Guides', link: '/icy/outils/guides' },
    { icon: 'tools', label: 'Outils', link: '/icy/outils' },
  ];

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private scwe: ScwePlayerService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userService.getMyProfile().subscribe({
      next: (response) => {
        const roles = (response?.data?.roles ?? []).map((role) => (role ?? '').trim().toUpperCase());
        this.isAdmin = roles.includes('ADMIN') || roles.includes('OFFICIER');
      },
      error: () => (this.isAdmin = false),
    });

    this.scwe.hasActiveEvent().subscribe({
      next: (v) => (this.hasActiveScEvent = !!v),
      error: () => (this.hasActiveScEvent = false),
    });
  }

  onClose() {
    this.requestClose.emit();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
    this.onClose();
  }
}
