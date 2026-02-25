import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'front-public-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './public-topbar.component.html',
  styleUrl: './public-topbar.component.css'
})
export class PublicTopbarComponent {
  constructor(private authService: AuthService) {}

  get memberSpaceLink(): string {
    return this.authService.hasToken() ? '/icy/dashboard' : '/login';
  }
}
