import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';
import { ScwePlayerService } from '../../core/services/scworldevent/scwe-player.service';
import { UserService } from '../../core/services/user/user.service';

type SidebarItem = {
  icon: string;
  label: string;
  link: string;
  kind?: 'scwe';
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit {
  @Input() isCollapsed = false;
  @Output() requestClose = new EventEmitter<void>();

  isAdmin = false;
  hasActiveScEvent = false;

  menuItems: SidebarItem[] = [
    { icon: '⌂', label: 'Dashboard', link: '/icy/dashboard' },

    // ✅ route corrigée (sinon NG04002)
    { icon: '🌍', label: 'SC World Events', link: '/icy/scwe', kind: 'scwe' },

    { icon: '🚀', label: 'Mon Hangar', link: '/icy/hangar' },
    { icon: '🛸', label: 'La flotte', link: '/icy/fleet' },
    { icon: '📆', label: 'Events', link: '/icy/events' },
    { icon: '📈', label: 'Objectifs', link: '/icy/goals' },
    { icon: '📚', label: 'Guides', link: '/utilitaires/guides' },
    { icon: '🛰️', label: 'Utilitaires', link: '/utilitaires' },
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
