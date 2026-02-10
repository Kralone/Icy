import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TemplateListItemDTO } from '../../../../model/collection.model';

@Component({
  selector: 'app-collection-templates',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './collection-templates.component.html',
})
export class CollectionTemplatesComponent {
  @Input() isLoading = false;
  @Input() error: unknown = null;
  @Input() templates: TemplateListItemDTO[] = [];
  @Input() totalTemplates = 0;
  @Input() loadingTemplateId: number | null = null;
  @Input() templateSearchTerm = '';
  @Input() templatePageIndex = 1;
  @Input() templateTotalPages = 1;

  @Output() templateSearchTermChange = new EventEmitter<string>();
  @Output() prevPage = new EventEmitter<void>();
  @Output() nextPage = new EventEmitter<void>();
  @Output() createFromTemplate = new EventEmitter<number>();

  trackById = (_: number, item: TemplateListItemDTO) => item.id;
}
