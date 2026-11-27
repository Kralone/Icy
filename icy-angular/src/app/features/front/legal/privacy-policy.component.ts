import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LEGAL_INFO } from './legal-info';

@Component({
  selector: 'front-privacy-policy',
  standalone: true,
  imports: [],
  templateUrl: './privacy-policy.component.html',
  styleUrl: './legal-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivacyPolicyComponent {
  readonly info = LEGAL_INFO;
}
