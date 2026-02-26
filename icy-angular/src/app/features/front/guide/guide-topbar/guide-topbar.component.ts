import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GuideBadgeTone } from '../guide-template/guide-template.types';

interface GuideTopbarTab {
  id: 'debutant' | 'avance' | 'ressources';
  label: string;
  route: string;
}

@Component({
  selector: 'front-guide-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './guide-topbar.component.html',
  styleUrl: './guide-topbar.component.css'
})
export class GuideTopbarComponent {
  @Input() compact = false;
  @Input() title = '';
  @Input() subtitle = '';
  @Input() statusLabel = '';
  @Input() statusTone: GuideBadgeTone | '' = '';
  @Input() updatedAt = '';
  @Input() readTime = '';
  @Input() difficulty = '';
  @Input() tags: readonly string[] = [];

  readonly tabs: readonly GuideTopbarTab[] = [
    { id: 'debutant', label: 'Guide debutant', route: '/guides/minage-star-citizen' },
    { id: 'avance', label: 'Guide avance', route: '/guides/minage/confirmed' },
    { id: 'ressources', label: 'Ressources', route: '/guides/minage/ressources' }
  ];

  constructor(private readonly router: Router) {}

  isTabActive(route: string): boolean {
    return this.router.url.startsWith(route);
  }

  get hasMeta(): boolean {
    return !!(this.updatedAt || this.readTime || this.difficulty);
  }

  get hasTags(): boolean {
    return this.tags.length > 0;
  }
}
