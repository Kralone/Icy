import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

import {IceLinkBlock} from '../../../../core/services/icelink/icelink-block.service';

@Component({
  selector: 'app-icelink-preview',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './icelink-preview.component.html',
})
export class IceLinkPreviewComponent {
  @Input() blocks: IceLinkBlock[] = [];

  get currentDate(): string {
    return new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).replace('2025', '2955');
  }
}
