import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Liens vers les mentions légales et la politique de confidentialité, pour les pieds de page. */
@Component({
  selector: 'front-legal-links',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="legal-links" aria-label="Informations légales">
      <a routerLink="/mentions-legales">Mentions légales</a>
      <span aria-hidden="true">·</span>
      <a routerLink="/confidentialite">Confidentialité</a>
    </nav>
  `,
  styles: `
    .legal-links {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: #64748b;
    }
    .legal-links a {
      color: #94a3b8;
      text-decoration: none;
    }
    .legal-links a:hover,
    .legal-links a:focus-visible {
      color: #67e8f9;
      text-decoration: underline;
    }
  `
})
export class LegalLinksComponent {}
