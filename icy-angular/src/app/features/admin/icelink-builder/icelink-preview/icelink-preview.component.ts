import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-icelink-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './icelink-preview.component.html',
})
export class IceLinkPreviewComponent {
  @Input() text: string = '';
}
