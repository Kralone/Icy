import { Component, OnInit, inject, ViewChild, TemplateRef } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import {VersionService} from './core/services/config/version.service';
import { UserActivityService } from './core/services/user/user-activity.service';
import { animate, query, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  imports: [
    RouterOutlet
  ],
  styleUrl: './app.component.css',
  animations: [
    trigger('routeTransition', [
      transition('LoginPage => IcyArea', [
        query(':enter, :leave', [
          style({
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%'
          })
        ], { optional: true }),
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(20px) scale(0.98)', filter: 'blur(4px)' })
        ], { optional: true }),
        query(':leave', [
          animate('280ms ease-in', style({ opacity: 0, transform: 'translateY(-12px) scale(1.01)', filter: 'blur(6px)' }))
        ], { optional: true }),
        query(':enter', [
          animate('420ms 80ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' }))
        ], { optional: true })
      ]),
      transition('IcyArea => LoginPage', [
        query(':enter, :leave', [
          style({
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%'
          })
        ], { optional: true }),
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(-16px) scale(0.99)', filter: 'blur(4px)' })
        ], { optional: true }),
        query(':leave', [
          animate('240ms ease-in', style({ opacity: 0, transform: 'translateY(10px) scale(1.01)', filter: 'blur(4px)' }))
        ], { optional: true }),
        query(':enter', [
          animate('360ms 60ms ease-out', style({ opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' }))
        ], { optional: true })
      ])
    ])
  ]
})
export class AppComponent implements OnInit {
  title = 'angular-iceforge';

  @ViewChild('updateToastTpl') updateToastTpl!: TemplateRef<any>;

  private versionService = inject(VersionService);
  private toast = inject(HotToastService);
  private userActivity = inject(UserActivityService);

  ngOnInit() {
    this.versionService.initVersionCheck();
    this.userActivity.start();

    this.versionService.updateDetected$.subscribe(() => {
      this.showUpdateToast();
    });
  }

  private showUpdateToast() {
    this.toast.show(this.updateToastTpl, {
      duration: 0,
      autoClose: false,
      dismissible: true,

      // ✅ 1. POSITION : Centre Haut
      position: 'top-center',

      // ✅ 2. STYLE
      style: {
        // Décale depuis le top via la marge officielle du composant
        '--hot-toast-margin': '24px 16px 0',

        // Force la taille "pilule" (ne prend pas toute la largeur)
        width: 'fit-content',
        maxWidth: '90vw',

        // Apparence
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(34, 211, 238, 0.3)',
        borderRadius: '9999px',
        padding: '12px 20px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        color: '#fff',
      },
    });
  }

  reloadPage() {
    window.location.reload();
  }

  prepareRoute(outlet: RouterOutlet): string {
    return (outlet.activatedRouteData?.['animation'] as string) ?? '';
  }
}
