import { Component, Input } from '@angular/core';


@Component({
  selector: 'app-fleet-mini-card',
  standalone: true,
  imports: [],
  templateUrl: './fleet-mini-card.component.html'
})
export class FleetMiniCardComponent {
  @Input() ship?: {
    name: string;
    imageUrl?: string;
    brandImageUrl?: string;
  };
}
