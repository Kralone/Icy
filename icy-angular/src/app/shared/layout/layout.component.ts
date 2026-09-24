import { Component, HostListener, ChangeDetectionStrategy } from '@angular/core';
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
  changeDetection: ChangeDetectionStrategy.Eager,
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
  private touchStartX: number | null = null;
  private touchStartY: number | null = null;
  private touchCurrentX: number | null = null;
  private touchCurrentY: number | null = null;

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

  onTouchStart(event: TouchEvent): void {
    if (this.isDesktop || event.touches.length !== 1) return;
    const touch = event.touches[0];
    this.touchStartX = this.touchCurrentX = touch.clientX;
    this.touchStartY = this.touchCurrentY = touch.clientY;
  }

  onTouchMove(event: TouchEvent): void {
    if (this.isDesktop || this.touchStartX === null || event.touches.length !== 1) return;
    const touch = event.touches[0];
    this.touchCurrentX = touch.clientX;
    this.touchCurrentY = touch.clientY;
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - (this.touchStartY ?? touch.clientY);
    if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY)) {
      event.preventDefault();
    }
  }

  onTouchCancel(): void {
    this.touchStartX = this.touchStartY = this.touchCurrentX = this.touchCurrentY = null;
  }

  onTouchEnd(event: TouchEvent): void {
    if (this.isDesktop || this.touchStartX === null) return;
    const endX = this.touchCurrentX ?? event.changedTouches[0]?.clientX ?? this.touchStartX;
    const endY = this.touchCurrentY ?? event.changedTouches[0]?.clientY ?? this.touchStartY ?? 0;
    const deltaX = endX - this.touchStartX;
    const deltaY = endY - (this.touchStartY ?? endY);
    if (Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      if (deltaX > 0 && !this.isSidebarOpen) this.isSidebarOpen = true;
      if (deltaX < 0 && this.isSidebarOpen) this.isSidebarOpen = false;
    }
    this.touchStartX = this.touchStartY = this.touchCurrentX = this.touchCurrentY = null;
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
