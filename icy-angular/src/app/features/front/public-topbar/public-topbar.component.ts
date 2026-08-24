
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';

type PublicMenuItem = {
  label: string;
  route: string;
};

@Component({
  selector: 'front-public-topbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './public-topbar.component.html',
  styleUrl: './public-topbar.component.css'
})
export class PublicTopbarComponent {
  constructor(private authService: AuthService) {}

  readonly guideItems: readonly PublicMenuItem[] = [
    { label: 'Guide minage', route: '/guides/minage-star-citizen' },
    { label: 'Guide salvage', route: '/guides/salvage' },
    { label: 'Guide Hathor', route: '/guides/hathor' }
  ];

  get memberSpaceLink(): string {
    return this.authService.hasToken() ? '/icy/dashboard' : '/login';
  }

  get isConnected(): boolean {
    return this.authService.hasToken();
  }

  get memberSpaceLabel(): string {
    return this.isConnected ? 'Retour espace interne' : 'Espace membre';
  }
}
