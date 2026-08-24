import { Component, Input, ChangeDetectionStrategy } from '@angular/core';


@Component({
  selector: 'app-collection-stats',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './collection-stats.component.html',
})
export class CollectionStatsComponent {
  @Input() totalCollections = 0;
  @Input() completionPercent = 0;
}
