import { Component, OnInit, inject, ViewChild, TemplateRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, NgIf, ViewportScroller } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import {VersionService} from './core/services/config/version.service';
import { UserActivityService } from './core/services/user/user-activity.service';
import { SeoService } from './core/services/seo/seo.service';
import { PublicTopbarComponent } from './features/front/public-topbar/public-topbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  imports: [
    NgIf,
    RouterOutlet,
    PublicTopbarComponent
  ],
  styleUrl: './app.component.css',
  animations: []
})
export class AppComponent implements OnInit {
  title = 'angular-iceforge';

  @ViewChild('updateToastTpl') updateToastTpl!: TemplateRef<any>;

  private versionService = inject(VersionService);
  private toast = inject(HotToastService);
  private userActivity = inject(UserActivityService);
  private seo = inject(SeoService);
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private viewportScroller = inject(ViewportScroller);

  ngOnInit() {
    this.seo.init();
    if (isPlatformBrowser(this.platformId)) {
      this.viewportScroller.setOffset([0, 72]);
      this.versionService.initVersionCheck();
      this.userActivity.start();
    }

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

  get showPublicTopbar(): boolean {
    const url = this.router.url || '';
    return !url.startsWith('/icy');
  }
}
