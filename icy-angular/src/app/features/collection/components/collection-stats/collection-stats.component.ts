import { Component, Input } from '@angular/core';


@Component({
  selector: 'app-collection-stats',
  standalone: true,
  imports: [],
  templateUrl: './collection-stats.component.html',
})
export class CollectionStatsComponent {
  @Input() totalCollections = 0;
  @Input() completionPercent = 0;
}
