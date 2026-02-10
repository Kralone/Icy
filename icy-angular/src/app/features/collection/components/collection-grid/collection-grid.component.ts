import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemplateDetailDTO, UserCollectionDetailDTO } from '../../../../model/collection.model';

@Component({
  selector: 'app-collection-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './collection-grid.component.html',
})
export class CollectionGridComponent {
  @Input() detail!: UserCollectionDetailDTO;
  @Input() template?: TemplateDetailDTO;
  @Output() toggleCell = new EventEmitter<{ detail: UserCollectionDetailDTO; x: number; y: number }>();

  getAxisX(): unknown {
    return this.template?.axisX ?? (this.detail as { axisX?: unknown }).axisX;
  }

  getAxisY(): unknown {
    return this.template?.axisY ?? (this.detail as { axisY?: unknown }).axisY;
  }

  getAxisLabels(axis: unknown): string[] {
    if (Array.isArray(axis)) return axis.map((it) => this.labelOf(it));
    if (axis && typeof axis === 'object') {
      const o = axis as Record<string, unknown>;
      if (Array.isArray(o['values'])) return (o['values'] as unknown[]).map(v => this.labelOf(v));
      if (Array.isArray(o['items'])) return (o['items'] as unknown[]).map(v => this.labelOf(v));
      const vals = Object.values(o);
      if (vals.every(v => v == null || ['string', 'number', 'boolean'].includes(typeof v)))
        return vals.map(v => String(v ?? ''));
      return [JSON.stringify(axis)];
    }
    return [];
  }

  isChecked(x: number, y: number): boolean {
    return this.detail.checked?.includes(`${x}|${y}`) ?? false;
  }

  private labelOf(item: unknown): string {
    if (item == null) return '';
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return String(item);
    if (typeof item === 'object') {
      const o = item as Record<string, unknown>;
      return String(o['label'] ?? o['name'] ?? o['value'] ?? o['key'] ?? JSON.stringify(o));
    }
    return String(item);
  }
}
