import { Component, EventEmitter, Input, Output } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TemplateListItemDTO, UserCollectionListItemDTO } from '../../../../model/collection.model';
import { LoadingOverlayComponent } from '../../../../shared/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-collection-list',
  standalone: true,
  imports: [FormsModule, LoadingOverlayComponent],
  templateUrl: './collection-list.component.html',
})
export class CollectionListComponent {
  @Input() isLoading = false;
  @Input() error: unknown = null;
  @Input() collections: UserCollectionListItemDTO[] = [];
  @Input() templateArchetypes: string[] = [];
  @Input() searchTerm = '';
  @Input() filterArchetype = 'all';
  @Input() filterProgress: 'all' | 'empty' | 'inprogress' | 'complete' = 'all';
  @Input() templateNameById = new Map<number, string>();
  @Input() templateById = new Map<number, TemplateListItemDTO>();
  @Input() getProgressPercent: (id: number) => number | null = () => null;
  @Input() formatDate: (value?: string) => string = () => '—';

  @Output() searchTermChange = new EventEmitter<string>();
  @Output() filterArchetypeChange = new EventEmitter<string>();
  @Output() filterProgressChange = new EventEmitter<'all' | 'empty' | 'inprogress' | 'complete'>();
  @Output() reload = new EventEmitter<void>();
  @Output() openDrawer = new EventEmitter<number>();
  @Output() removeCollection = new EventEmitter<number>();

  trackById = (_: number, item: UserCollectionListItemDTO) => item.id;
}
