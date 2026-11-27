import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL_INFO } from './legal-info';

@Component({
  selector: 'front-privacy-policy',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './legal-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivacyPolicyComponent {
  readonly info = LEGAL_INFO;
}
