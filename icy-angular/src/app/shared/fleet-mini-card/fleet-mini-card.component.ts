import { Component, Input, ChangeDetectionStrategy } from '@angular/core';


@Component({
  selector: 'app-fleet-mini-card',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './fleet-mini-card.component.html'
})
export class FleetMiniCardComponent {
  @Input() ship?: {
    name: string;
    imageUrl?: string;
    brandImageUrl?: string;
  };
}
