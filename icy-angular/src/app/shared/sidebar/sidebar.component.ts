import {Component, EventEmitter, HostBinding, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router, RouterLink, RouterLinkActive} from '@angular/router';
import {AuthService} from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
  ],
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Output() sidebarToggled = new EventEmitter<boolean>();
  @HostBinding('class.sidebar-visible') isVisible = false;

  isAdminUser = false;

  constructor(
    private authService: AuthService,
    private router: Router) {
  }

  ngOnInit() {
    this.isAdminUser = this.authService.isAdmin();

    setTimeout(() => {
      this.isVisible = true;
    }, 300);
  }
  menuItems = [
    { icon: '⌂', label: 'Dashboard', link: '/icy/dashboard' },
    { icon: '🚀', label: 'Mon Hangar', link: '/icy/hangar' },
    { icon: '📆', label: 'Events', link: '/icy/events' },
    { icon: '📈', label: 'Objectifs', link: '/icy/goals' }
  ];

  isCollapsed = false;

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    this.sidebarToggled.emit(this.isCollapsed);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

}
