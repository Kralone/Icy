import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-fleet-mini-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fleet-mini-card.component.html'
})
export class FleetMiniCardComponent {
  @Input() ship?: {
    name: string;
    imageUrl?: string;
    brandImageUrl?: string;
  };
}
