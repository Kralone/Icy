import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-collection-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './collection-stats.component.html',
})
export class CollectionStatsComponent {
  @Input() totalCollections = 0;
  @Input() completionPercent = 0;
}
