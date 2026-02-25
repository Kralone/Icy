import { Component, HostListener } from '@angular/core';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { animate, group, query, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-layout',
  imports: [SidebarComponent, TopbarComponent, RouterOutlet, CommonModule],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
  animations: [
    trigger('utilitySlide', [
      transition('ExecHangarPage => ExecMapsPage', [
        style({ position: 'relative' }),
        query(':enter, :leave', [
          style({ position: 'absolute', inset: 0, width: '100%' })
        ], { optional: true }),
        query(':enter', [style({ transform: 'translateX(100%)', opacity: 0.85 })], { optional: true }),
        group([
          query(':leave', [animate('320ms ease', style({ transform: 'translateX(-24%)', opacity: 0 }))], { optional: true }),
          query(':enter', [animate('320ms ease', style({ transform: 'translateX(0)', opacity: 1 }))], { optional: true })
        ])
      ]),
      transition('ExecMapsPage => ExecHangarPage', [
        style({ position: 'relative' }),
        query(':enter, :leave', [
          style({ position: 'absolute', inset: 0, width: '100%' })
        ], { optional: true }),
        query(':enter', [style({ transform: 'translateX(-100%)', opacity: 0.85 })], { optional: true }),
        group([
          query(':leave', [animate('320ms ease', style({ transform: 'translateX(24%)', opacity: 0 }))], { optional: true }),
          query(':enter', [animate('320ms ease', style({ transform: 'translateX(0)', opacity: 1 }))], { optional: true })
        ])
      ]),
      transition('ExecHangarPage => ExecPlayersPage', [
        style({ position: 'relative' }),
        query(':enter, :leave', [
          style({ position: 'absolute', inset: 0, width: '100%' })
        ], { optional: true }),
        query(':enter', [style({ transform: 'translateX(-100%)', opacity: 0.85 })], { optional: true }),
        group([
          query(':leave', [animate('320ms ease', style({ transform: 'translateX(24%)', opacity: 0 }))], { optional: true }),
          query(':enter', [animate('320ms ease', style({ transform: 'translateX(0)', opacity: 1 }))], { optional: true })
        ])
      ]),
      transition('ExecPlayersPage => ExecHangarPage', [
        style({ position: 'relative' }),
        query(':enter, :leave', [
          style({ position: 'absolute', inset: 0, width: '100%' })
        ], { optional: true }),
        query(':enter', [style({ transform: 'translateX(100%)', opacity: 0.85 })], { optional: true }),
        group([
          query(':leave', [animate('320ms ease', style({ transform: 'translateX(-24%)', opacity: 0 }))], { optional: true }),
          query(':enter', [animate('320ms ease', style({ transform: 'translateX(0)', opacity: 1 }))], { optional: true })
        ])
      ])
    ])
  ]
})
export class LayoutComponent {
  isSidebarOpen = false;
  isDesktop = false;

  constructor() {
    this.checkViewport();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkViewport();
  }

  private checkViewport(): void {
    this.isDesktop = window.innerWidth >= 1280; // breakpoint XL
    if (this.isDesktop) this.isSidebarOpen = false;
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  closeSidebar(): void {
    if (!this.isDesktop) this.isSidebarOpen = false;
  }

  prepareRoute(outlet: RouterOutlet): string {
    return outlet?.activatedRouteData?.['animation'] ?? '';
  }
}
