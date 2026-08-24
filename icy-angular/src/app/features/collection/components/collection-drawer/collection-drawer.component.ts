import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

import { CollectionGridComponent } from '../collection-grid/collection-grid.component';
import { UserCollectionDetailDTO } from '../../../../model/collection.model';

@Component({
  selector: 'app-collection-drawer',
  standalone: true,
  imports: [CollectionGridComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './collection-drawer.component.html',
})
export class CollectionDrawerComponent {
  @Input() isOpen = false;
  @Input() selectedCollectionId: number | null = null;
  @Input() selectedLabel = '';
  @Input() selectedTemplateName = '';
  @Input() rowLoading = new Set<number>();
  @Input() rowError = new Map<number, unknown>();
  @Input() progressPercent = 0;
  @Input() detail: UserCollectionDetailDTO | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() toggleCell = new EventEmitter<{ detail: UserCollectionDetailDTO; x: number; y: number }>();
}
