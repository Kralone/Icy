import {Component, EventEmitter, HostBinding, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink, RouterLinkActive} from '@angular/router';

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

  ngOnInit() {
    setTimeout(() => {
      this.isVisible = true;
    }, 300);
  }
  menuItems = [
    { icon: '⌂', label: 'Dashboard', link: '/icy/dashboard' },
    { icon: '🚀', label: 'Mon Hangar', link: '/icy/hangar' },
    { icon: '📁', label: 'Projects', link: '#' },
    { icon: '⚙️', label: 'Settings', link: '#' }
  ];

  isCollapsed = false;

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    this.sidebarToggled.emit(this.isCollapsed);
  }

  logout() {
    console.log("Déconnexion..."); // À remplacer par ta logique de déconnexion
  }

}
