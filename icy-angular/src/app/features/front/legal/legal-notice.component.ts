import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEGAL_INFO } from './legal-info';

@Component({
  selector: 'front-legal-notice',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './legal-notice.component.html',
  styleUrl: './legal-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegalNoticeComponent {
  readonly info = LEGAL_INFO;
}
