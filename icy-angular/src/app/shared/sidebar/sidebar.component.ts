import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Input() isCollapsed = false;
  @Output() requestClose = new EventEmitter<void>();

  isAdmin = false;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.authService.isAdmin().subscribe(isAdmin => {
      this.isAdmin = isAdmin;
    });
  }

  menuItems = [
    { icon: '⌂', label: 'Dashboard', link: '/icy/dashboard' },
    { icon: '🚀', label: 'Mon Hangar', link: '/icy/hangar' },
    { icon: '🛸', label: 'La flotte', link: '/icy/fleet' },
    { icon: '📆', label: 'Events', link: '/icy/events' },
    { icon: '📈', label: 'Objectifs', link: '/icy/goals' },
    { icon: '📦', label: 'Collection', link: '/icy/collection' },
  ];

  onClose() {
    this.requestClose.emit();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
    this.onClose();
  }
}
